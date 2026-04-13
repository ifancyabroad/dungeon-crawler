import type { ActorId, FloorState, GameEvent } from "./types";
import { VISION_RADIUS } from "../config/game";
import type { Rng } from "../rng";
import type { ActiveSkillDefinition, SkillDefinition } from "../skills";
import { resolveSkill, hasActiveEffect } from "../skills";
import { STATUS_HOOKS } from "../config/skills";
import { resolveAttack } from "../combat/resolveAttack";
import { applyDamageToActor } from "../combat/applyDamageToActor";
import { runNpcAI, type NpcAIState, type CombatStrategyTag } from "./strategies";
import { computeVisibility } from "../map/visibility";
import { idxToXY, computeAttackMod, computeWeaponProficiencyBonus } from "./engineUtils";

/**
 * After a player action, each living NPC on the hero's floor acts.
 * Each NPC runs its AI strategy: chase/roam/attack/skill based on LoS.
 * Sorted by actor ID for deterministic order.
 * `getSkillDef` is required to resolve NPC skill actions.
 */
export function processEnemyTurns(
	floorState: FloorState,
	heroId: ActorId,
	width: number,
	height: number,
	walkableMask: Uint8Array,
	opacityMask: Uint8Array,
	rng: Rng,
	getSkillDef: (skillId: string) => SkillDefinition | undefined,
): { floorState: FloorState; events: GameEvent[] } {
	const events: GameEvent[] = [];
	let actorsById = { ...floorState.actorsById };
	const hero = actorsById[heroId];
	if (!hero || !hero.alive) return { floorState, events };

	const npcIds = Object.keys(actorsById)
		.filter(
			(id) => id !== heroId && actorsById[id]!.alive && actorsById[id]!.def.type === "npc",
		)
		.sort();

	let currentHero = hero;
	// If the hero is stealthed AND not revealed, NPCs cannot see them regardless of LoS.
	const heroIsStealthed =
		hasActiveEffect(currentHero, STATUS_HOOKS.STEALTH) &&
		!hasActiveEffect(currentHero, STATUS_HOOKS.REVEALED);

	// Pre-compute effective factions for this turn.
	// CHARMED flips a hostile actor's faction to "player" transiently — the stored faction
	// is never mutated, ensuring status effects cannot corrupt persisted game state.
	const effectiveFactions: Record<string, "player" | "hostile"> = {};
	for (const [id, actor] of Object.entries(actorsById)) {
		const base = actor.faction ?? (actor.def.type === "hero" ? "player" : "hostile");
		effectiveFactions[id] = hasActiveEffect(actor, STATUS_HOOKS.CHARMED) ? "player" : base;
	}

	for (const mid of npcIds) {
		if (!currentHero.alive) break;
		const npc = actorsById[mid]!;

		// NPCs without aiState are inert (shouldn't happen in normal play)
		const aiState = npc.aiState;
		if (!aiState) continue;

		// Stunned and silenced NPCs skip their turn entirely.
		// Rooted NPCs can still act but cannot move.
		if (hasActiveEffect(npc, STATUS_HOOKS.STUNNED)) continue;

		const { x, y } = idxToXY(npc.idx, width);
		let visibleFromNpc = computeVisibility(x, y, width, height, opacityMask, VISION_RADIUS);

		// Stealth: mask hero tile so all AI strategies treat the hero as invisible.
		if (heroIsStealthed) {
			visibleFromNpc = visibleFromNpc.slice() as Uint8Array;
			visibleFromNpc[currentHero.idx] = 0;
		}

		// Build a temporary floor state snapshot so AI sees the current actor positions
		const currentFloorState: FloorState = { ...floorState, actorsById };

		// FRIGHTENED overrides the combat strategy to flee.
		const isFrightened = hasActiveEffect(npc, STATUS_HOOKS.FRIGHTENED);
		const combatStrategyOverride: CombatStrategyTag | undefined = isFrightened
			? "frightened"
			: undefined;

		// CHARMED temporarily overrides the idle strategy to follow the hero.
		// The stale lastKnownEnemyIdx is cleared if it still points at the hero's tile
		// (it was tracking the hero as a former enemy; the hero is now an ally).
		const isCharmed = hasActiveEffect(npc, STATUS_HOOKS.CHARMED);
		const effectiveAIState: NpcAIState = isCharmed
			? {
					...aiState,
					idleStrategy: "follow",
					followTargetId: heroId,
					lastKnownEnemyIdx:
						aiState.lastKnownEnemyIdx === currentHero.idx
							? undefined
							: aiState.lastKnownEnemyIdx,
				}
			: aiState;

		const { result, newAIState } = runNpcAI({
			npc,
			aiState: effectiveAIState,
			hero: currentHero,
			heroId,
			visibleFromNpc,
			walkableMask,
			floorState: currentFloorState,
			width,
			height,
			rng,
			effectiveFactions,
			combatStrategyOverride,
			getSkillDef,
		});

		// Restore overridden fields — transient overrides must not persist to saved state.
		let persistedAIState = newAIState;
		if (combatStrategyOverride) {
			persistedAIState = { ...persistedAIState, combatStrategy: aiState.combatStrategy };
		}
		if (isCharmed) {
			persistedAIState = {
				...persistedAIState,
				idleStrategy: aiState.idleStrategy,
				followTargetId: aiState.followTargetId,
			};
		}

		if (result.kind === "attack") {
			// Generalised attack target: ally AI targets hostiles; default targets hero.
			const attackTargetId = result.targetActorId ?? heroId;
			const attackTarget = actorsById[attackTargetId];
			if (!attackTarget?.alive) {
				actorsById = { ...actorsById, [mid]: { ...npc, aiState: persistedAIState } };
			} else {
				const attackResult = resolveAttack(
					npc,
					attackTarget,
					rng,
					npc.equippedWeaponDice,
					computeAttackMod(npc),
					computeWeaponProficiencyBonus(npc),
				);
				events.push({
					type: "attack",
					attackerId: mid,
					defenderId: attackTargetId,
					result: attackResult,
				});

				if (attackResult.hit) {
					const { updatedActor: damagedTarget, events: damageEvents } =
						applyDamageToActor(attackTarget, attackResult.damage);
					events.push(...damageEvents);
					if (attackTargetId === heroId) {
						currentHero = damagedTarget;
					}
					actorsById = {
						...actorsById,
						[attackTargetId]: damagedTarget,
						[mid]: { ...npc, aiState: persistedAIState },
					};
					if (!damagedTarget.alive) {
						events.push({ type: "death", actorId: attackTargetId });
						// TODO: grant XP to the hero for kills made by charmed allies.
						// processEnemyTurns currently has no access to ApplyActionContext,
						// which is required by grantXpForKill for level-up offer generation.
					}
				} else {
					actorsById = {
						...actorsById,
						[mid]: { ...npc, aiState: persistedAIState },
					};
				}
			}
		} else if (result.kind === "move") {
			// Rooted NPCs cannot move — treat as idle.
			if (hasActiveEffect(npc, STATUS_HOOKS.ROOTED)) {
				actorsById = { ...actorsById, [mid]: { ...npc, aiState: persistedAIState } };
			} else {
				actorsById = {
					...actorsById,
					[mid]: { ...npc, idx: result.toIdx, aiState: persistedAIState },
				};
			}
		} else if (result.kind === "skill") {
			// NPC uses a skill — silenced NPCs fall back to idle.
			if (hasActiveEffect(npc, STATUS_HOOKS.SILENCED)) {
				actorsById = { ...actorsById, [mid]: { ...npc, aiState: persistedAIState } };
			} else {
				// Resolved the same way as hero skills.
				const rawSkillDef = getSkillDef(result.skillId);
				const skillDef =
					rawSkillDef?.skillType === "active"
						? (rawSkillDef as ActiveSkillDefinition)
						: undefined;
				const skillState = npc.skills?.[result.skillId];
				if (skillDef && skillState && skillState.cooldownRemaining === 0) {
					const currentFloorSnapshot: FloorState = { ...floorState, actorsById };
					const resolution = resolveSkill({
						skillDef,
						rank: skillState.rank,
						caster: { ...npc, aiState: persistedAIState },
						casterId: mid,
						floorState: currentFloorSnapshot,
						width,
						height,
						rng,
						targetTileIdx: result.targetTileIdx,
						targetActorId: result.targetActorId,
						opacityMask,
					});
					if (!("error" in resolution)) {
						const npcAfterSkill = resolution.floorState.actorsById[mid];
						if (npcAfterSkill) {
							actorsById = {
								...resolution.floorState.actorsById,
								[mid]: {
									...npcAfterSkill,
									skills: {
										...npcAfterSkill.skills,
										[result.skillId]: {
											...skillState,
											cooldownRemaining: skillDef.cooldown + 1,
											floorUsesRemaining:
												skillState.floorUsesRemaining !== undefined
													? skillState.floorUsesRemaining - 1
													: undefined,
										},
									},
								},
							};
						} else {
							actorsById = resolution.floorState.actorsById;
						}
						events.push(...resolution.events);
						const heroAfterSkill = actorsById[heroId];
						if (heroAfterSkill) currentHero = heroAfterSkill;
						if (!currentHero.alive) break;
					} else {
						actorsById = {
							...actorsById,
							[mid]: { ...npc, aiState: persistedAIState },
						};
					}
				} else {
					// Skill on cooldown or unknown — fall back to idle
					actorsById = { ...actorsById, [mid]: { ...npc, aiState: persistedAIState } };
				}
			}
		} else {
			// idle — persist updated aiState (e.g. cleared lastKnownEnemyIdx)
			actorsById = { ...actorsById, [mid]: { ...npc, aiState: persistedAIState } };
		}
	}

	return { floorState: { ...floorState, actorsById }, events };
}
