/**
 * Deterministic game engine: create initial state and apply actions.
 * Walkability: pass via context.getWalkableMask (required in production; use applyActionWithDerivedContext for dev/test).
 * RNG state is only advanced when an action actually uses RNG (e.g. future spawns/combat).
 */

import type { Action } from "./actions";
import type {
	Actor,
	ActorId,
	FloorConfig,
	FloorState,
	GameEvent,
	GameState,
	PendingInteraction,
	PersistedDynamicState,
} from "./types";
import { createRngFromState } from "../rng";
import { computeWalkableMaskForFloor, regenerateBaseMaps } from "../map";
import { computeOpacityMask, computeVisibility, mergeExplored } from "../map/visibility";
import { resolveAttack } from "../combat/combat";
import { applyDamageToActor } from "../combat/applyDamageToActor";
import { UNARMED_WEAPON } from "../combat/types";
import {
	resolveSkill,
	hasActiveEffect,
	tickActiveEffects,
	applyPassiveSkill,
	STATUS_HOOKS,
} from "../skills";
import type { ActiveSkillDefinition } from "../skills";
import { idxToXY, xyToIdx, getHero, getActorAtIdx, DIRECTION_DELTA } from "./engineUtils";
import type { ApplyActionContext, ApplyActionResult } from "./engineContext";
import { createActionContext, createEmptyFloorState } from "./engineContext";
import { processEnemyTurns } from "./engineEnemyTurns";
import { grantXpForKill, sampleWithoutReplacement } from "./engineLevelUp";
import { VISION_RADIUS } from "./config";

// ---------------------------------------------------------------------------
// Re-exports — preserve the public surface so game/index.ts is unchanged
// ---------------------------------------------------------------------------

export {
	actorKind,
	findAdjacentWalkable,
	getActorAtIdx,
	getAdjacentIndices,
	getHero,
	idxToXY,
	xyToIdx,
} from "./engineUtils";
export {
	createActionContext,
	createEmptyFloorState,
	type ApplyActionContext,
	type ApplyActionResult,
	type ClassSkillPools,
} from "./engineContext";
export {
	createInitialState,
	DEFAULT_HERO_INIT,
	resetMonsterCounter,
	spawnMonster,
} from "./engineInit";
export { LEVEL_UP_SCHEDULE } from "./engineLevelUp";

// ---------------------------------------------------------------------------
// Private turn helpers
// ---------------------------------------------------------------------------

function computeTargetCell(
	heroIdx: number,
	direction: "up" | "down" | "left" | "right",
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
 * Decrement cooldownRemaining by 1 for every skill on the hero.
 * Called at the end of every player turn so cooldowns count down with each action.
 */
function tickSkillCooldowns(state: GameState): GameState {
	const fi = state.heroFloorIndex;
	const floor = state.floors[fi];
	if (!floor) return state;
	const hero = floor.state.actorsById[state.heroId];
	if (!hero) return state;

	const updatedSkills: Record<string, { level?: number; cooldownRemaining: number }> = {};
	for (const [id, s] of Object.entries(hero.skills)) {
		updatedSkills[id] = {
			...s,
			cooldownRemaining: Math.max(0, s.cooldownRemaining - 1),
		};
	}

	const updatedHero: Actor = { ...hero, skills: updatedSkills };
	const newFloors = state.floors.slice();
	newFloors[fi] = {
		...floor,
		state: {
			...floor.state,
			actorsById: { ...floor.state.actorsById, [state.heroId]: updatedHero },
		},
	};
	return { ...state, floors: newFloors };
}

/**
 * If the hero is stealthed, remove the stealth effect and alert all living monsters
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
		if (id === heroId || !actor.alive || actor.def.type !== "monster" || !actor.aiState)
			continue;
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
		action.type === "select_skill_choice" || action.type === "reroll_skill_choice";
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
			if (getActorAtIdx(floor.state, newIdx)) {
				return { ok: false, reason: "move_blocked_by_enemy" };
			}

			const updatedHero: Actor = { ...hero, idx: newIdx };
			const newActorsById = { ...floor.state.actorsById, [state.heroId]: updatedHero };

			const opacityMask = context.getOpacityMask(fi);
			const visible = computeVisibility(nx, ny, width, height, opacityMask, VISION_RADIUS);
			const explored = mergeExplored(floor.state.explored, visible, size);

			let newFloorState: FloorState = { ...floor.state, actorsById: newActorsById, explored };

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
			const events: GameEvent[] = [...enemyResult.events];

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
			const attackResult = resolveAttack(activeHero, defender, rng, UNARMED_WEAPON);
			events.push({
				type: "attack",
				attackerId: state.heroId,
				defenderId: defender.id,
				result: attackResult,
			});

			let updatedHero: Actor = activeHero;
			let updatedDefender: Actor | undefined;
			let attackPendingInteraction: PendingInteraction = null;
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
					} = grantXpForKill(activeHero, state.heroId, defender.xpReward, rng, context);
					updatedHero = heroWithXp;
					events.push(...xpEvents);
					if (xpInteraction) attackPendingInteraction = xpInteraction;
				}
			}
			const newActorsById = {
				...activeFloorState.actorsById,
				[state.heroId]: updatedHero,
				...(updatedDefender ? { [defender.id]: updatedDefender } : {}),
			};

			let newFloorState: FloorState = { ...activeFloorState, actorsById: newActorsById };

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

			// Grant XP for any kills caused by the skill
			let updatedHero = heroAfterSkill;
			const skillXpEvents: GameEvent[] = [];
			let skillPendingInteraction: PendingInteraction = null;
			for (const event of resolution.events) {
				if (event.type === "death") {
					const dead = newFloorState.actorsById[event.actorId];
					if (dead?.def.type === "monster") {
						const {
							actor: heroWithXp,
							events: xpEvents,
							pendingInteraction: xpInteraction,
						} = grantXpForKill(updatedHero, state.heroId, dead.xpReward, rng, context);
						updatedHero = heroWithXp;
						skillXpEvents.push(...xpEvents);
						if (xpInteraction) skillPendingInteraction = xpInteraction;
					}
				}
			}

			// Re-sync updated hero (XP/level may have changed) and emit XP events
			newFloorState = {
				...newFloorState,
				actorsById: { ...newFloorState.actorsById, [state.heroId]: updatedHero },
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
			if (!pi.offers.includes(action.skillId)) {
				return { ok: false, reason: "skill_not_in_offers" };
			}

			const skillDef = context.getSkillDef(action.skillId);
			if (!skillDef) return { ok: false, reason: "skill_unknown" };

			const fi = state.heroFloorIndex;
			const floor = state.floors[fi];
			if (!floor) return { ok: false, reason: "no_floor" };
			const hero = getHero(state);
			if (!hero) return { ok: false, reason: "no_hero" };

			// Grant the skill to the hero's skill list
			let heroWithSkill: Actor = {
				...hero,
				skills: { ...hero.skills, [action.skillId]: { cooldownRemaining: 0 } },
			};

			// Apply passive effects permanently
			if (skillDef.skillType === "passive") {
				heroWithSkill = applyPassiveSkill(heroWithSkill, skillDef);
			}

			const newFloors = state.floors.slice();
			newFloors[fi] = {
				...floor,
				state: {
					...floor.state,
					actorsById: { ...floor.state.actorsById, [state.heroId]: heroWithSkill },
				},
			};

			const skillGrantedState: GameState = {
				...state,
				turn: state.turn + 1,
				floors: newFloors,
				pendingInteraction: null,
			};

			return {
				ok: true,
				state: skillGrantedState,
				events: [{ type: "skill_granted", actorId: state.heroId, skillId: action.skillId }],
			};
		}

		case "reroll_skill_choice": {
			const pi = state.pendingInteraction;
			if (pi?.type !== "skill_choice") {
				return { ok: false, reason: "no_pending_choice" };
			}

			const hero = getHero(state);
			if (!hero) return { ok: false, reason: "no_hero" };
			const classId = hero.def.type === "hero" ? hero.def.classId : null;
			const pools = classId ? context.getClassSkillPools(classId) : undefined;
			if (!pools) return { ok: false, reason: "no_skill_pools" };

			const { rng, getState: getRngState } = createRngFromState(state.rngState);

			const pool = pi.offerType === "active" ? pools.activeSkillPool : pools.passiveSkillPool;
			const ownedSkillIds = new Set(Object.keys(hero.skills));
			// Also exclude the current offers so reroll always shows different options
			const currentOffers = new Set(pi.offers);
			const eligible = pool.filter((id) => !ownedSkillIds.has(id) && !currentOffers.has(id));

			// If there are fewer or equal eligible skills than current offers, don't exclude current
			const finalEligible =
				eligible.length > 0 ? eligible : pool.filter((id) => !ownedSkillIds.has(id));
			const newOffers = sampleWithoutReplacement(finalEligible, 3, rng);

			const rerolledState: GameState = {
				...state,
				turn: state.turn + 1,
				rngState: getRngState(),
				pendingInteraction: {
					...pi,
					offers: newOffers,
					rerollsUsed: pi.rerollsUsed + 1,
				},
			};

			return { ok: true, state: rerolledState, events: [] };
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
