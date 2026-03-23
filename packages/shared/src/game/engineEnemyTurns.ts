import type { ActorId, FloorState, GameEvent } from "./types";
import { VISION_RADIUS } from "./config";
import type { Rng } from "../rng";
import type { ActiveSkillDefinition, SkillDefinition } from "../skills";
import { resolveSkill, hasActiveEffect, STATUS_HOOKS } from "../skills";
import { resolveAttack } from "../combat/resolveAttack";
import { applyDamageToActor } from "../combat/applyDamageToActor";
import { UNARMED_WEAPON } from "../combat/types";
import { runMonsterAI, type MonsterAIState, type CombatStrategyTag } from "./strategies";
import { computeVisibility } from "../map/visibility";
import { idxToXY } from "./engineUtils";

/**
 * After a player action, each living monster on the hero's floor acts.
 * Each monster runs its AI strategy: chase/roam/attack/skill based on LoS.
 * Sorted by actor ID for deterministic order.
 * `getSkillDef` is required to resolve monster skill actions.
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

	const monsterIds = Object.keys(actorsById)
		.filter(
			(id) =>
				id !== heroId && actorsById[id]!.alive && actorsById[id]!.def.type === "monster",
		)
		.sort();

	let currentHero = hero;
	// If the hero is stealthed, monsters cannot see them regardless of LoS.
	const heroIsStealthed = hasActiveEffect(currentHero, STATUS_HOOKS.STEALTH);

	// Pre-compute effective factions for this turn.
	// CHARMED flips a hostile actor's faction to "player" transiently — the stored faction
	// is never mutated, ensuring status effects cannot corrupt persisted game state.
	const effectiveFactions: Record<string, "player" | "hostile"> = {};
	for (const [id, actor] of Object.entries(actorsById)) {
		const base = actor.faction ?? (actor.def.type === "hero" ? "player" : "hostile");
		effectiveFactions[id] = hasActiveEffect(actor, STATUS_HOOKS.CHARMED) ? "player" : base;
	}

	for (const mid of monsterIds) {
		if (!currentHero.alive) break;
		const monster = actorsById[mid]!;

		// Monsters without aiState are inert (shouldn't happen in normal play)
		const aiState = monster.aiState;
		if (!aiState) continue;

		// Stunned monsters skip their turn entirely.
		if (hasActiveEffect(monster, STATUS_HOOKS.STUNNED)) continue;

		const { x, y } = idxToXY(monster.idx, width);
		let visibleFromMonster = computeVisibility(x, y, width, height, opacityMask, VISION_RADIUS);

		// Stealth: mask hero tile so all AI strategies treat the hero as invisible.
		if (heroIsStealthed) {
			visibleFromMonster = visibleFromMonster.slice() as Uint8Array;
			visibleFromMonster[currentHero.idx] = 0;
		}

		// Build a temporary floor state snapshot so AI sees the current actor positions
		const currentFloorState: FloorState = { ...floorState, actorsById };

		// FRIGHTENED overrides the combat strategy to flee.
		const isFrightened = hasActiveEffect(monster, STATUS_HOOKS.FRIGHTENED);
		const combatStrategyOverride: CombatStrategyTag | undefined = isFrightened
			? "frightened"
			: undefined;

		// CHARMED temporarily overrides the idle strategy to follow the hero.
		// The stale lastKnownEnemyIdx is cleared if it still points at the hero's tile
		// (it was tracking the hero as a former enemy; the hero is now an ally).
		const isCharmed = hasActiveEffect(monster, STATUS_HOOKS.CHARMED);
		const effectiveAIState: MonsterAIState = isCharmed
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

		const { result, newAIState } = runMonsterAI({
			monster,
			aiState: effectiveAIState,
			hero: currentHero,
			heroId,
			visibleFromMonster,
			walkableMask,
			floorState: currentFloorState,
			width,
			height,
			rng,
			effectiveFactions,
			combatStrategyOverride,
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
				actorsById = { ...actorsById, [mid]: { ...monster, aiState: persistedAIState } };
			} else {
				const attackResult = resolveAttack(monster, attackTarget, rng, UNARMED_WEAPON);
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
						[mid]: { ...monster, aiState: persistedAIState },
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
						[mid]: { ...monster, aiState: persistedAIState },
					};
				}
			}
		} else if (result.kind === "move") {
			actorsById = {
				...actorsById,
				[mid]: { ...monster, idx: result.toIdx, aiState: persistedAIState },
			};
		} else if (result.kind === "skill") {
			// Monster uses a skill — resolved the same way as hero skills.
			const rawSkillDef = getSkillDef(result.skillId);
			const skillDef =
				rawSkillDef?.skillType === "active"
					? (rawSkillDef as ActiveSkillDefinition)
					: undefined;
			const skillState = monster.skills?.[result.skillId];
			if (skillDef && skillState && skillState.cooldownRemaining === 0) {
				const currentFloorSnapshot: FloorState = { ...floorState, actorsById };
				const resolution = resolveSkill({
					skillDef,
					caster: { ...monster, aiState: persistedAIState },
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
					const monsterAfterSkill = resolution.floorState.actorsById[mid];
					if (monsterAfterSkill) {
						actorsById = {
							...resolution.floorState.actorsById,
							[mid]: {
								...monsterAfterSkill,
								skills: {
									...monsterAfterSkill.skills,
									[result.skillId]: { cooldownRemaining: skillDef.cooldown },
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
						[mid]: { ...monster, aiState: persistedAIState },
					};
				}
			} else {
				// Skill on cooldown or unknown — fall back to idle
				actorsById = { ...actorsById, [mid]: { ...monster, aiState: persistedAIState } };
			}
		} else {
			// idle — persist updated aiState (e.g. cleared lastKnownEnemyIdx)
			actorsById = { ...actorsById, [mid]: { ...monster, aiState: persistedAIState } };
		}
	}

	return { floorState: { ...floorState, actorsById }, events };
}
