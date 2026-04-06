/**
 * Deterministic game engine: create initial state and apply actions.
 * Walkability: pass via context.getWalkableMask (required in production; use applyActionWithDerivedContext for dev/test).
 * RNG state is only advanced when an action actually uses RNG (e.g. future spawns/combat).
 */

import type { Action, Direction } from "./actions";
import { rollLootDrop } from "../items/lootGeneration";
import { applyEquipment } from "../items/applyEquipment";
import type {
	Actor,
	ActorId,
	EquipmentSlots,
	FloorConfig,
	FloorState,
	GameEvent,
	GameState,
	LootDrop,
	PendingInteraction,
	PersistedDynamicState,
} from "./types";
import type { ItemInstance } from "../items/types";
import { createRngFromState } from "../rng";
import { computeWalkableMaskForFloor, regenerateBaseMaps } from "../map";
import { computeOpacityMask, computeVisibility, mergeExplored } from "../map/visibility";
import { resolveAttack } from "../combat/resolveAttack";
import { applyDamageToActor } from "../combat/applyDamageToActor";

import { resolveSkill, hasActiveEffect, tickActiveEffects, applyPassiveSkill } from "../skills";
import { STATUS_HOOKS } from "../config/skills";
import type { ActiveSkillDefinition } from "../skills";
import {
	idxToXY,
	xyToIdx,
	getHero,
	getActorAtIdx,
	DIRECTION_DELTA,
	isSqueezeBlocked,
	computeAttackMod,
	computeWeaponProficiencyBonus,
} from "./engineUtils";
import type { ApplyActionContext, ApplyActionResult } from "./engineContext";
import { createActionContext, createEmptyFloorState } from "./engineContext";
import { processEnemyTurns } from "./engineEnemyTurns";
import { grantXp, checkForLevelUp, generateSkillOffers } from "./engineLevelUp";
import { VISION_RADIUS } from "../config/game";

// ---------------------------------------------------------------------------
// Re-exports for consumers that import implementation helpers from `engine/`
// ---------------------------------------------------------------------------

export {
	actorKind,
	DIRECTION_DELTA,
	findAdjacentWalkable,
	getActorAtIdx,
	getAdjacentIndices,
	getAdjacentIndices8,
	getHero,
	idxToXY,
	isSqueezeBlocked,
	xyToIdx,
} from "./engineUtils";
export {
	createActionContext,
	createEmptyFloorState,
	type ApplyActionContext,
	type ApplyActionResult,
	type ClassSkillPools,
} from "./engineContext";
export { createInitialState, DEFAULT_HERO_INIT, resetNpcCounter, spawnNpc } from "./engineInit";
export { generateSkillOffers, checkForLevelUp, grantXp } from "./engineLevelUp";

// ---------------------------------------------------------------------------
// Private turn helpers
// ---------------------------------------------------------------------------

function computeTargetCell(
	heroIdx: number,
	direction: Direction,
	width: number,
	height: number,
): { nx: number; ny: number; newIdx: number } | null {
	const { x, y } = idxToXY(heroIdx, width);
	const { dx, dy } = DIRECTION_DELTA[direction];
	const nx = x + dx;
	const ny = y + dy;
	if (nx < 0 || nx >= width || ny < 0 || ny >= height) return null;
	return { nx, ny, newIdx: xyToIdx(nx, ny, width) };
}

/**
 * Decrement cooldownRemaining by 1 for every skill on every living actor on the hero's floor.
 * Called at the end of every player turn so cooldowns count down with each action.
 */
function tickSkillCooldowns(state: GameState): GameState {
	const fi = state.heroFloorIndex;
	const floor = state.floors[fi];
	if (!floor) return state;

	let actorsById = floor.state.actorsById;
	for (const [actorId, actor] of Object.entries(actorsById)) {
		if (!actor.alive || Object.keys(actor.skills).length === 0) continue;
		const updatedSkills: Record<string, { rank: number; cooldownRemaining: number }> = {};
		for (const [id, s] of Object.entries(actor.skills)) {
			updatedSkills[id] = {
				...s,
				cooldownRemaining: Math.max(0, s.cooldownRemaining - 1),
			};
		}
		actorsById = { ...actorsById, [actorId]: { ...actor, skills: updatedSkills } };
	}

	const newFloors = state.floors.slice();
	newFloors[fi] = {
		...floor,
		state: { ...floor.state, actorsById },
	};
	return { ...state, floors: newFloors };
}

/**
 * If the hero is stealthed, remove the stealth effect and alert all living NPCs
 * to the hero's current position. Called before enemy turns on attack and skill use,
 * so enemies can retaliate immediately after the hero reveals themselves.
 */
function breakStealth(
	hero: Actor,
	heroId: ActorId,
	floorState: FloorState,
): { hero: Actor; floorState: FloorState } {
	if (!hasActiveEffect(hero, STATUS_HOOKS.STEALTH)) return { hero, floorState };

	const updatedHero: Actor = {
		...hero,
		activeEffects: hero.activeEffects.filter((e) => e.id !== "stealth"),
	};

	let actorsById: Record<string, Actor> = {
		...floorState.actorsById,
		[heroId]: updatedHero,
	};

	for (const [id, actor] of Object.entries(actorsById)) {
		if (id === heroId || !actor.alive || actor.def.type !== "npc" || !actor.aiState) continue;
		actorsById = {
			...actorsById,
			[id]: { ...actor, aiState: { ...actor.aiState!, lastKnownEnemyIdx: hero.idx } },
		};
	}

	return { hero: updatedHero, floorState: { ...floorState, actorsById } };
}

// ---------------------------------------------------------------------------
// Apply action
// ---------------------------------------------------------------------------

/**
 * Apply one action to state. Context is required (use applyActionWithDerivedContext in dev/test only).
 * RNG is advanced only when the action involves combat.
 * After every successful player action, enemy turns are processed.
 */
export function applyAction(
	state: GameState,
	action: Action,
	context: ApplyActionContext,
): ApplyActionResult {
	// -------------------------------------------------------------------------
	// Pause gate: when a pendingInteraction is active, all regular game actions
	// are blocked. Only meta-actions that resolve the interaction may proceed.
	// -------------------------------------------------------------------------
	const isInteractionAction =
		action.type === "select_skill_choice" ||
		action.type === "reroll_skill_choice" ||
		action.type === "pickup_item" ||
		action.type === "pickup_gold" ||
		action.type === "leave_loot";
	if (state.pendingInteraction !== null && !isInteractionAction) {
		return { ok: false, reason: "interaction_required" };
	}

	switch (action.type) {
		case "move": {
			const hero = getHero(state);
			if (!hero || !hero.alive) return { ok: false, reason: "move_no_hero" };
			if (hasActiveEffect(hero, STATUS_HOOKS.STUNNED)) {
				return { ok: false, reason: "hero_stunned" };
			}
			if (hasActiveEffect(hero, STATUS_HOOKS.ROOTED)) {
				return { ok: false, reason: "hero_rooted" };
			}
			const fi = state.heroFloorIndex;
			const floor = state.floors[fi];
			if (!floor) return { ok: false, reason: "move_no_floor" };
			const width = floor.config.width;
			const height = floor.config.height;
			const size = width * height;
			const mask = context.getWalkableMask(fi);

			const target = computeTargetCell(hero.idx, action.direction, width, height);
			if (!target) return { ok: false, reason: "move_out_of_bounds" };
			const { nx, ny, newIdx } = target;
			if (newIdx < 0 || newIdx >= size || mask[newIdx] !== 1) {
				return { ok: false, reason: "move_blocked" };
			}
			const { dx, dy } = DIRECTION_DELTA[action.direction];
			if (dx !== 0 && dy !== 0) {
				const { x: hx, y: hy } = idxToXY(hero.idx, width);
				if (isSqueezeBlocked(hx, hy, dx, dy, width, height, mask)) {
					return { ok: false, reason: "move_blocked" };
				}
			}
			if (getActorAtIdx(floor.state, newIdx)) {
				return { ok: false, reason: "move_blocked_by_enemy" };
			}

			const updatedHero: Actor = { ...hero, idx: newIdx };
			const newActorsById = { ...floor.state.actorsById, [state.heroId]: updatedHero };

			const opacityMask = context.getOpacityMask(fi);
			const visible = computeVisibility(nx, ny, width, height, opacityMask, VISION_RADIUS);
			const explored = mergeExplored(floor.state.explored, visible, size);

			let newFloorState: FloorState = { ...floor.state, actorsById: newActorsById, explored };

			// Loot tile detection: hero stepped onto a tile that has a loot pile.
			const moveLoot = newFloorState.lootByIdx[String(newIdx)];
			let movePendingInteraction: PendingInteraction = null;
			const moveEvents: GameEvent[] = [];
			if (moveLoot) {
				if (moveLoot.items.length === 0 && moveLoot.gold) {
					// Gold-only pile: auto-collect.
					const goldAmount = moveLoot.gold;
					const heroWithGold: Actor = {
						...updatedHero,
						gold: updatedHero.gold + goldAmount,
					};
					const clearedLootByIdx = { ...newFloorState.lootByIdx };
					delete clearedLootByIdx[String(newIdx)];
					const clearedOverrides = { ...newFloorState.tileOverrides };
					delete clearedOverrides[String(newIdx)];
					newFloorState = {
						...newFloorState,
						actorsById: { ...newFloorState.actorsById, [state.heroId]: heroWithGold },
						lootByIdx: clearedLootByIdx,
						tileOverrides: clearedOverrides,
					};
					moveEvents.push({
						type: "gold_collected",
						actorId: state.heroId,
						amount: goldAmount,
						tileIdx: newIdx,
					});
				} else {
					// Multi-item pile (or gold + items): pause for loot pickup modal.
					movePendingInteraction = {
						type: "loot_pickup",
						tileIdx: newIdx,
						loot: moveLoot,
					};
				}
			}

			// Skip enemy turns and paused processing if hero stepped on a loot pile.
			if (movePendingInteraction) {
				const pausedFloors = state.floors.slice();
				pausedFloors[fi] = { ...floor, state: newFloorState };
				const pausedState: GameState = {
					...state,
					turn: state.turn + 1,
					floors: pausedFloors,
					pendingInteraction: movePendingInteraction,
				};
				return { ok: true, state: pausedState, events: moveEvents };
			}

			// Enemy turns on current floor (before potential descend)
			const { rng, getState: getRngState } = createRngFromState(state.rngState);
			const enemyResult = processEnemyTurns(
				newFloorState,
				state.heroId,
				width,
				height,
				mask,
				opacityMask,
				rng,
				context.getSkillDef,
			);
			newFloorState = enemyResult.floorState;

			const newFloors = state.floors.slice();
			newFloors[fi] = { ...floor, state: newFloorState };

			let newState: GameState = {
				...state,
				turn: state.turn + 1,
				floors: newFloors,
				rngState: getRngState(),
			};
			const events: GameEvent[] = [...moveEvents, ...enemyResult.events];

			// Auto-descend: hero stepped onto the exit tile and a next floor exists
			const heroAfterMove = newFloorState.actorsById[state.heroId];
			if (
				heroAfterMove?.alive &&
				floor.state.exitIdx !== null &&
				newIdx === floor.state.exitIdx &&
				fi < state.floors.length - 1
			) {
				const nextFi = fi + 1;
				const nextFloor = newState.floors[nextFi];
				if (nextFloor) {
					// Remove hero from current floor, place on next floor at spawn
					const departingFloorState: FloorState = {
						...newFloorState,
						actorsById: Object.fromEntries(
							Object.entries(newFloorState.actorsById).filter(
								([id]) => id !== state.heroId,
							),
						),
					};
					const descendingHero: Actor = {
						...heroAfterMove,
						idx: nextFloor.state.spawnIdx,
					};

					// Compute initial visibility on next floor
					const nextWidth = nextFloor.config.width;
					const nextHeight = nextFloor.config.height;
					const nextOpMask = context.getOpacityMask(nextFi);
					const { x: spawnX, y: spawnY } = idxToXY(nextFloor.state.spawnIdx, nextWidth);
					const nextVisible = computeVisibility(
						spawnX,
						spawnY,
						nextWidth,
						nextHeight,
						nextOpMask,
						VISION_RADIUS,
					);
					const nextExplored = mergeExplored(
						nextFloor.state.explored,
						nextVisible,
						nextWidth * nextHeight,
					);

					const nextFloorState: FloorState = {
						...nextFloor.state,
						actorsById: {
							...nextFloor.state.actorsById,
							[state.heroId]: descendingHero,
						},
						explored: nextExplored,
					};

					const descendFloors = newState.floors.slice();
					descendFloors[fi] = { ...newState.floors[fi]!, state: departingFloorState };
					descendFloors[nextFi] = { ...nextFloor, state: nextFloorState };

					events.push({ type: "descend", fromFloor: fi, toFloor: nextFi });

					newState = {
						...newState,
						heroFloorIndex: nextFi,
						floors: descendFloors,
					};
				}
			}

			const { state: tickedMoveState, events: tickMoveEvents } = tickActiveEffects(newState);
			newState = tickSkillCooldowns(tickedMoveState);
			events.push(...tickMoveEvents);

			return { ok: true, state: newState, events };
		}

		case "attack": {
			const hero = getHero(state);
			if (!hero || !hero.alive) return { ok: false, reason: "attack_no_hero" };
			if (hasActiveEffect(hero, STATUS_HOOKS.STUNNED)) {
				return { ok: false, reason: "hero_stunned" };
			}
			const fi = state.heroFloorIndex;
			const floor = state.floors[fi];
			if (!floor) return { ok: false, reason: "attack_no_floor" };
			const width = floor.config.width;
			const height = floor.config.height;

			const target = computeTargetCell(hero.idx, action.direction, width, height);
			if (!target) return { ok: false, reason: "attack_out_of_bounds" };
			const { dx: adx, dy: ady } = DIRECTION_DELTA[action.direction];
			if (adx !== 0 && ady !== 0) {
				const attackMask = context.getWalkableMask(fi);
				const { x: hx, y: hy } = idxToXY(hero.idx, width);
				if (isSqueezeBlocked(hx, hy, adx, ady, width, height, attackMask)) {
					return { ok: false, reason: "attack_out_of_bounds" };
				}
			}

			const defender = getActorAtIdx(floor.state, target.newIdx);
			if (!defender) return { ok: false, reason: "attack_no_target" };

			const { rng, getState: getRngState } = createRngFromState(state.rngState);
			const events: GameEvent[] = [];

			// Attacking breaks stealth — hero is revealed before enemy turns.
			const { hero: heroAfterBreak, floorState: floorAfterBreak } = breakStealth(
				hero,
				state.heroId,
				floor.state,
			);
			const activeHero = heroAfterBreak;
			const activeFloorState = floorAfterBreak;

			// Hero attacks enemy
			const attackResult = resolveAttack(
				activeHero,
				defender,
				rng,
				activeHero.equippedWeaponDice,
				computeAttackMod(activeHero),
				computeWeaponProficiencyBonus(activeHero),
			);
			events.push({
				type: "attack",
				attackerId: state.heroId,
				defenderId: defender.id,
				result: attackResult,
			});

			let updatedHero: Actor = activeHero;
			let updatedDefender: Actor | undefined;
			let attackPendingInteraction: PendingInteraction = null;
			let attackLootOverrides: Record<string, number> | undefined;
			let attackLootByIdx: Record<string, LootDrop> | undefined;
			if (attackResult.hit) {
				const { updatedActor, events: damageEvents } = applyDamageToActor(
					defender,
					attackResult.damage,
				);
				updatedDefender = updatedActor;
				events.push(...damageEvents);
				if (!updatedDefender.alive) {
					events.push({ type: "death", actorId: defender.id });
					const {
						actor: heroWithXp,
						events: xpEvents,
						pendingInteraction: xpInteraction,
					} = grantXp(
						activeHero,
						state.heroId,
						defender.xpReward,
						rng,
						context.getClassSkillPools,
					);
					updatedHero = heroWithXp;
					events.push(...xpEvents);
					if (xpInteraction) attackPendingInteraction = xpInteraction;

					// Loot generation: roll drop table if context has required data.
					if (context.itemsById && context.affixesById) {
						const loot = rollLootDrop(
							updatedDefender,
							fi,
							rng,
							context.itemsById,
							context.affixesById,
						);
						if (loot) {
							const npcIdx = updatedDefender.idx;
							const idxKey = String(npcIdx);
							const tileId = loot.items.length > 0 ? 827 : 825;
							attackLootOverrides = { [idxKey]: tileId };
							attackLootByIdx = { [idxKey]: loot };
							events.push({ type: "loot_dropped", tileIdx: npcIdx, loot });
						}
					}
				}
			}
			const newActorsById = {
				...activeFloorState.actorsById,
				[state.heroId]: updatedHero,
				...(updatedDefender ? { [defender.id]: updatedDefender } : {}),
			};

			let newFloorState: FloorState = {
				...activeFloorState,
				actorsById: newActorsById,
				...(attackLootOverrides && {
					tileOverrides: { ...activeFloorState.tileOverrides, ...attackLootOverrides },
				}),
				...(attackLootByIdx && {
					lootByIdx: { ...activeFloorState.lootByIdx, ...attackLootByIdx },
				}),
			};

			// Enemy turns after attack (skip if we're about to pause for a skill choice)
			if (!attackPendingInteraction) {
				const attackWalkMask = context.getWalkableMask(fi);
				const attackOpacityMask = context.getOpacityMask(fi);
				const enemyResult = processEnemyTurns(
					newFloorState,
					state.heroId,
					width,
					height,
					attackWalkMask,
					attackOpacityMask,
					rng,
					context.getSkillDef,
				);
				newFloorState = enemyResult.floorState;
				events.push(...enemyResult.events);
			}

			const newFloors = state.floors.slice();
			newFloors[fi] = { ...floor, state: newFloorState };

			let attackNewState: GameState = {
				...state,
				turn: state.turn + 1,
				floors: newFloors,
				rngState: getRngState(),
				pendingInteraction: attackPendingInteraction,
			};
			// Only tick status/cooldowns when game is not pausing
			if (!attackPendingInteraction) {
				const { state: tickedAttackState, events: tickAttackEvents } =
					tickActiveEffects(attackNewState);
				events.push(...tickAttackEvents);
				attackNewState = tickSkillCooldowns(tickedAttackState);
			}

			return { ok: true, state: attackNewState, events };
		}

		case "use_skill": {
			const hero = getHero(state);
			if (!hero || !hero.alive) return { ok: false, reason: "skill_no_hero" };
			if (hasActiveEffect(hero, STATUS_HOOKS.STUNNED)) {
				return { ok: false, reason: "hero_stunned" };
			}
			if (hasActiveEffect(hero, STATUS_HOOKS.SILENCED)) {
				return { ok: false, reason: "hero_silenced" };
			}
			const fi = state.heroFloorIndex;
			const floor = state.floors[fi];
			if (!floor) return { ok: false, reason: "skill_no_floor" };

			const skillDef = context.getSkillDef(action.skillId);
			if (!skillDef) return { ok: false, reason: "skill_unknown" };

			// Passive skills cannot be used via the hotbar
			if (skillDef.skillType === "passive") return { ok: false, reason: "skill_is_passive" };

			// Validate that the hero has this skill (it was awarded at creation)
			const skillState = hero.skills[action.skillId];
			if (!skillState) return { ok: false, reason: "skill_not_owned" };
			if (skillState.cooldownRemaining > 0) return { ok: false, reason: "skill_on_cooldown" };
			if (!hero.armorProficient) return { ok: false, reason: "skill_armor_not_proficient" };

			const width = floor.config.width;
			const height = floor.config.height;
			const { rng, getState: getRngState } = createRngFromState(state.rngState);

			// Using a skill that doesn't explicitly maintain stealth reveals the hero.
			const { hero: heroForSkill, floorState: floorForSkill } = !(
				skillDef as ActiveSkillDefinition
			).maintainsStealth
				? breakStealth(hero, state.heroId, floor.state)
				: { hero, floorState: floor.state };

			const resolution = resolveSkill({
				skillDef: skillDef as ActiveSkillDefinition,
				rank: skillState.rank,
				caster: heroForSkill,
				casterId: state.heroId,
				floorState: floorForSkill,
				width,
				height,
				rng,
				targetTileIdx: action.targetTileIdx,
				targetActorId: action.targetActorId,
				opacityMask: context.getOpacityMask(fi),
			});

			if ("error" in resolution) return { ok: false, reason: resolution.error };

			// Set cooldown on the caster (hero)
			const heroAfterSkill: Actor = {
				...resolution.caster,
				skills: {
					...resolution.caster.skills,
					[action.skillId]: { ...skillState, cooldownRemaining: skillDef.cooldown },
				},
			};

			let newFloorState: FloorState = {
				...resolution.floorState,
				actorsById: {
					...resolution.floorState.actorsById,
					[state.heroId]: heroAfterSkill,
				},
			};

			// Grant XP and roll loot for any kills caused by the skill
			let updatedHero = heroAfterSkill;
			const skillXpEvents: GameEvent[] = [];
			let skillPendingInteraction: PendingInteraction = null;
			let skillLootOverrides: Record<string, number> | undefined;
			let skillLootByIdx: Record<string, LootDrop> | undefined;
			for (const event of resolution.events) {
				if (event.type === "death") {
					const dead = newFloorState.actorsById[event.actorId];
					if (dead?.def.type === "npc") {
						const {
							actor: heroWithXp,
							events: xpEvents,
							pendingInteraction: xpInteraction,
						} = grantXp(
							updatedHero,
							state.heroId,
							dead.xpReward,
							rng,
							context.getClassSkillPools,
						);
						updatedHero = heroWithXp;
						skillXpEvents.push(...xpEvents);
						if (xpInteraction) skillPendingInteraction = xpInteraction;

						// Loot generation
						if (context.itemsById && context.affixesById) {
							const loot = rollLootDrop(
								dead,
								fi,
								rng,
								context.itemsById,
								context.affixesById,
							);
							if (loot) {
								const npcIdx = dead.idx;
								const idxKey = String(npcIdx);
								const tileId = loot.items.length > 0 ? 827 : 825;
								skillLootOverrides = { ...skillLootOverrides, [idxKey]: tileId };
								skillLootByIdx = { ...skillLootByIdx, [idxKey]: loot };
								skillXpEvents.push({ type: "loot_dropped", tileIdx: npcIdx, loot });
							}
						}
					}
				}
			}

			// Re-sync updated hero (XP/level may have changed) and merge loot state
			newFloorState = {
				...newFloorState,
				actorsById: { ...newFloorState.actorsById, [state.heroId]: updatedHero },
				...(skillLootOverrides && {
					tileOverrides: { ...newFloorState.tileOverrides, ...skillLootOverrides },
				}),
				...(skillLootByIdx && {
					lootByIdx: { ...newFloorState.lootByIdx, ...skillLootByIdx },
				}),
			};

			// Enemy turns (skip if we're about to pause for a skill choice)
			if (!skillPendingInteraction) {
				const skillWalkMask = context.getWalkableMask(fi);
				const skillOpacityMask = context.getOpacityMask(fi);
				const enemyResult = processEnemyTurns(
					newFloorState,
					state.heroId,
					width,
					height,
					skillWalkMask,
					skillOpacityMask,
					rng,
					context.getSkillDef,
				);
				newFloorState = enemyResult.floorState;
				skillXpEvents.push(...enemyResult.events);
			}

			const newFloors = state.floors.slice();
			newFloors[fi] = { ...floor, state: newFloorState };

			let newState: GameState = {
				...state,
				turn: state.turn + 1,
				floors: newFloors,
				rngState: getRngState(),
				pendingInteraction: skillPendingInteraction,
			};

			// Only tick status/cooldowns when game is not pausing
			if (!skillPendingInteraction) {
				const { state: tickedSkillState, events: tickSkillEvents } =
					tickActiveEffects(newState);
				skillXpEvents.push(...tickSkillEvents);
				newState = tickSkillCooldowns(tickedSkillState);
			}

			return {
				ok: true,
				state: newState,
				events: [...resolution.events, ...skillXpEvents],
			};
		}

		case "select_skill_choice": {
			const pi = state.pendingInteraction;
			if (pi?.type !== "skill_choice") {
				return { ok: false, reason: "no_pending_choice" };
			}

			const offer = pi.offers.find((o) => o.skillId === action.skillId);
			if (!offer) {
				return { ok: false, reason: "skill_not_in_offers" };
			}

			const skillDef = context.getSkillDef(action.skillId);
			if (!skillDef) return { ok: false, reason: "skill_unknown" };

			const fi = state.heroFloorIndex;
			const floor = state.floors[fi];
			if (!floor) return { ok: false, reason: "no_floor" };
			const hero = getHero(state);
			if (!hero) return { ok: false, reason: "no_hero" };

			const previousRank = hero.skills[action.skillId]?.rank ?? 0;
			const newRank = offer.rank;

			// Grant (new) or upgrade (existing) the skill
			let heroWithSkill: Actor = {
				...hero,
				skills: {
					...hero.skills,
					[action.skillId]: { rank: newRank, cooldownRemaining: 0 },
				},
			};

			// Apply passive effects permanently (delta from previous rank)
			if (skillDef.skillType === "passive") {
				heroWithSkill = applyPassiveSkill(heroWithSkill, skillDef, previousRank, newRank);
			}

			// Check whether the hero's banked XP qualifies them for another level-up.
			const { rng: cascadeRng, getState: getCascadeRngState } = createRngFromState(
				state.rngState,
			);
			const {
				actor: heroAfterCascade,
				events: cascadeEvents,
				pendingInteraction: cascadeInteraction,
			} = checkForLevelUp(
				heroWithSkill,
				state.heroId,
				cascadeRng,
				context.getClassSkillPools,
			);

			// heroAfterCascade already contains the new skill (spread from heroWithSkill above).
			const finalFloors = state.floors.slice();
			finalFloors[fi] = {
				...floor,
				state: {
					...floor.state,
					actorsById: { ...floor.state.actorsById, [state.heroId]: heroAfterCascade },
				},
			};

			return {
				ok: true,
				state: {
					...state,
					turn: state.turn + 1,
					floors: finalFloors,
					pendingInteraction: cascadeInteraction,
					rngState: getCascadeRngState(),
				},
				events: [
					{ type: "skill_granted", actorId: state.heroId, skillId: action.skillId },
					...cascadeEvents,
				],
			};
		}

		case "reroll_skill_choice": {
			const pi = state.pendingInteraction;
			if (pi?.type !== "skill_choice") {
				return { ok: false, reason: "no_pending_choice" };
			}

			const hero = getHero(state);
			if (!hero) return { ok: false, reason: "no_hero" };

			// Gold cost check.
			if (hero.gold < pi.rerollCost) {
				return { ok: false, reason: "insufficient_gold" };
			}

			const classId = hero.def.type === "hero" ? hero.def.classId : null;
			const pools = classId ? context.getClassSkillPools(classId) : undefined;
			if (!pools) return { ok: false, reason: "no_skill_pools" };

			const { rng, getState: getRngState } = createRngFromState(state.rngState);

			// Exclude skills already shown in this offer to encourage variety
			const currentOfferSkillIds = new Set(pi.offers.map((o) => o.skillId));
			const newOffers = generateSkillOffers(hero, pools, rng, currentOfferSkillIds);

			const fi = state.heroFloorIndex;
			const floor = state.floors[fi];
			if (!floor) return { ok: false, reason: "no_floor" };
			const heroAfterGold: Actor = { ...hero, gold: hero.gold - pi.rerollCost };
			const rerolledFloors = state.floors.slice();
			rerolledFloors[fi] = {
				...floor,
				state: {
					...floor.state,
					actorsById: { ...floor.state.actorsById, [state.heroId]: heroAfterGold },
				},
			};

			const rerolledState: GameState = {
				...state,
				turn: state.turn + 1,
				rngState: getRngState(),
				floors: rerolledFloors,
				pendingInteraction: {
					...pi,
					offers: newOffers,
					rerollsUsed: pi.rerollsUsed + 1,
				},
			};

			return { ok: true, state: rerolledState, events: [] };
		}

		case "pickup_item": {
			const pi = state.pendingInteraction;
			if (pi?.type !== "loot_pickup") return { ok: false, reason: "no_pending_loot" };
			if (pi.tileIdx !== action.tileIdx) return { ok: false, reason: "loot_tile_mismatch" };
			if (!context.itemsById) return { ok: false, reason: "no_item_defs" };

			const fi = state.heroFloorIndex;
			const floor = state.floors[fi];
			if (!floor) return { ok: false, reason: "no_floor" };
			const hero = getHero(state);
			if (!hero) return { ok: false, reason: "no_hero" };

			const instanceIdx = pi.loot.items.findIndex((i) => i.instanceId === action.instanceId);
			if (instanceIdx === -1) return { ok: false, reason: "item_not_in_loot" };
			const instance = pi.loot.items[instanceIdx]!;
			const baseDef = context.itemsById[instance.baseItemId];
			if (!baseDef) return { ok: false, reason: "item_def_not_found" };

			// Determine target slot.
			let targetSlot: keyof EquipmentSlots | null = null;
			if (baseDef.type === "weapon") targetSlot = "mainHand";
			else if (baseDef.type === "shield") targetSlot = "offHand";
			else if (baseDef.type === "armor") {
				const s = baseDef.slot;
				targetSlot =
					s === "body"
						? "body"
						: s === "head"
							? "head"
							: s === "hands"
								? "hands"
								: "feet";
			} else if (baseDef.type === "accessory") {
				if (baseDef.slot === "ring") {
					targetSlot = !hero.equipment.ring1 ? "ring1" : "ring2";
				} else {
					targetSlot = "amulet";
				}
			}
			if (!targetSlot) return { ok: false, reason: "item_slot_unknown" };

			// Update hero's equipment and instance registry.
			const updatedEquipment: EquipmentSlots = {
				...hero.equipment,
				[targetSlot]: instance.instanceId,
			};
			const updatedInstances: Record<string, ItemInstance> = {
				...hero.itemInstances,
				[instance.instanceId]: instance,
			};
			let heroAfterEquip: Actor = {
				...hero,
				equipment: updatedEquipment,
				itemInstances: updatedInstances,
			};
			heroAfterEquip = applyEquipment(
				heroAfterEquip,
				context.itemsById,
				heroAfterEquip.itemInstances,
				context.affixesById ?? {},
			);

			// Remove taken item from loot pile.
			const remainingItems = pi.loot.items.filter((_, i) => i !== instanceIdx);
			const updatedLoot: LootDrop = { ...pi.loot, items: remainingItems };
			const idxKey = String(pi.tileIdx);

			let updatedLootByIdx: Record<string, LootDrop>;
			let updatedTileOverrides: Record<string, number>;
			let newPendingInteraction: PendingInteraction;

			const pileEmpty = remainingItems.length === 0 && !updatedLoot.gold;
			if (pileEmpty) {
				updatedLootByIdx = { ...floor.state.lootByIdx };
				delete updatedLootByIdx[idxKey];
				updatedTileOverrides = { ...floor.state.tileOverrides };
				delete updatedTileOverrides[idxKey];
				newPendingInteraction = null;
			} else {
				updatedLootByIdx = { ...floor.state.lootByIdx, [idxKey]: updatedLoot };
				// Update tile to gold-only if items are all taken but gold remains.
				const newTileId = remainingItems.length > 0 ? 827 : 825;
				updatedTileOverrides = { ...floor.state.tileOverrides, [idxKey]: newTileId };
				newPendingInteraction = { ...pi, loot: updatedLoot };
			}

			const pickupFloors = state.floors.slice();
			pickupFloors[fi] = {
				...floor,
				state: {
					...floor.state,
					actorsById: { ...floor.state.actorsById, [state.heroId]: heroAfterEquip },
					lootByIdx: updatedLootByIdx,
					tileOverrides: updatedTileOverrides,
				},
			};

			return {
				ok: true,
				state: {
					...state,
					turn: state.turn + 1,
					floors: pickupFloors,
					pendingInteraction: newPendingInteraction,
				},
				events: [
					{
						type: "item_looted",
						actorId: state.heroId,
						item: instance,
						slot: targetSlot,
					},
				],
			};
		}

		case "pickup_gold": {
			const pi = state.pendingInteraction;
			if (pi?.type !== "loot_pickup") return { ok: false, reason: "no_pending_loot" };
			if (pi.tileIdx !== action.tileIdx) return { ok: false, reason: "loot_tile_mismatch" };
			if (!pi.loot.gold) return { ok: false, reason: "no_gold_in_loot" };

			const fi = state.heroFloorIndex;
			const floor = state.floors[fi];
			if (!floor) return { ok: false, reason: "no_floor" };
			const hero = getHero(state);
			if (!hero) return { ok: false, reason: "no_hero" };

			const goldAmount = pi.loot.gold;
			const heroWithGold: Actor = { ...hero, gold: hero.gold + goldAmount };
			const updatedLoot: LootDrop = { ...pi.loot, gold: undefined };
			const idxKey = String(pi.tileIdx);

			let updatedLootByIdx: Record<string, LootDrop>;
			let updatedTileOverrides: Record<string, number>;
			let newPendingInteraction: PendingInteraction;

			const pileEmpty = updatedLoot.items.length === 0;
			if (pileEmpty) {
				updatedLootByIdx = { ...floor.state.lootByIdx };
				delete updatedLootByIdx[idxKey];
				updatedTileOverrides = { ...floor.state.tileOverrides };
				delete updatedTileOverrides[idxKey];
				newPendingInteraction = null;
			} else {
				updatedLootByIdx = { ...floor.state.lootByIdx, [idxKey]: updatedLoot };
				updatedTileOverrides = { ...floor.state.tileOverrides, [idxKey]: 827 };
				newPendingInteraction = { ...pi, loot: updatedLoot };
			}

			const goldFloors = state.floors.slice();
			goldFloors[fi] = {
				...floor,
				state: {
					...floor.state,
					actorsById: { ...floor.state.actorsById, [state.heroId]: heroWithGold },
					lootByIdx: updatedLootByIdx,
					tileOverrides: updatedTileOverrides,
				},
			};

			return {
				ok: true,
				state: {
					...state,
					turn: state.turn + 1,
					floors: goldFloors,
					pendingInteraction: newPendingInteraction,
				},
				events: [
					{
						type: "gold_collected",
						actorId: state.heroId,
						amount: goldAmount,
						tileIdx: pi.tileIdx,
					},
				],
			};
		}

		case "leave_loot": {
			const pi = state.pendingInteraction;
			if (pi?.type !== "loot_pickup") return { ok: false, reason: "no_pending_loot" };
			if (pi.tileIdx !== action.tileIdx) return { ok: false, reason: "loot_tile_mismatch" };

			const fi = state.heroFloorIndex;
			const floor = state.floors[fi];
			if (!floor) return { ok: false, reason: "no_floor" };

			const idxKey = String(pi.tileIdx);
			const clearedLootByIdx = { ...floor.state.lootByIdx };
			delete clearedLootByIdx[idxKey];
			const clearedTileOverrides = { ...floor.state.tileOverrides };
			delete clearedTileOverrides[idxKey];

			const leaveFloors = state.floors.slice();
			leaveFloors[fi] = {
				...floor,
				state: {
					...floor.state,
					lootByIdx: clearedLootByIdx,
					tileOverrides: clearedTileOverrides,
				},
			};

			return {
				ok: true,
				state: {
					...state,
					turn: state.turn + 1,
					floors: leaveFloors,
					pendingInteraction: null,
				},
				events: [],
			};
		}

		case "unknown":
			return { ok: false, reason: "unknown_action" };
		default: {
			const _exhaustive: never = action;
			void _exhaustive;
			return { ok: false, reason: "unknown_action" };
		}
	}
}

// ---------------------------------------------------------------------------
// Dev/test helper + persistence
// ---------------------------------------------------------------------------

/**
 * Dev/test only: build context from state (regenerateBaseMaps + masks per floor) and apply action.
 * Do not use in production API; production must pass context from cache.
 */
export function applyActionWithDerivedContext(state: GameState, action: Action): ApplyActionResult {
	const baseLayers = regenerateBaseMaps(
		state.seed,
		state.floors.map((f) => f.config),
		state.mapGenVersion,
	);
	const walkableMasks = baseLayers.map((base, i) =>
		computeWalkableMaskForFloor(base, state.floors[i]?.state.tileOverrides ?? {}),
	);
	const opacityMasks = baseLayers.map((base) =>
		computeOpacityMask(base.wall, base.width, base.height),
	);
	const context = createActionContext(walkableMasks, opacityMasks);
	return applyAction(state, action, context);
}

/**
 * Build full GameState from persisted dynamic state + session metadata.
 * No walkableByFloor on returned state.
 */
export function buildGameStateFromPersisted(
	seed: number,
	mapGenVersion: number,
	floorConfigs: FloorConfig[],
	persisted: PersistedDynamicState,
): GameState {
	const defaultFloorState = createEmptyFloorState();
	const floors = floorConfigs.map((config, i) => ({
		config,
		state: persisted.floors[i] ?? defaultFloorState,
	}));
	return {
		turn: persisted.turn,
		heroId: persisted.heroId,
		heroFloorIndex: persisted.heroFloorIndex,
		seed,
		mapGenVersion,
		floors,
		rngState: persisted.rngState,
		pendingInteraction: persisted.pendingInteraction ?? null,
	};
}

/** Convert full GameState to persisted dynamic state (for snapshots). Single source of truth for the shape. */
export function gameStateToPersisted(state: GameState): PersistedDynamicState {
	return {
		turn: state.turn,
		heroId: state.heroId,
		heroFloorIndex: state.heroFloorIndex,
		floors: state.floors.map((f) => f.state),
		rngState: state.rngState,
		pendingInteraction: state.pendingInteraction,
	};
}
