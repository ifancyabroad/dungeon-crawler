/**
 * Shared NPC skill evaluator.
 *
 * Provides a single `evaluateNpcSkill` function that all AI strategies delegate
 * to for skill selection. Strategies call this first and only handle
 * movement/positioning themselves.
 *
 * Priority order:
 *   1. Defensive    — heal_self when HP < 40%
 *   2. Self-buff    — apply_shield or pure self apply_status when enemy visible
 *   3. Approach     — charge/leap/shadow_step when dist >= 2 and in range
 *   4. Combat       — actor or tile targeted (non-approach) when in range
 *   5. AoE          — self-cast area effects when dist <= AoE radius
 *
 * Classification is derived from effect types (ground truth), not tags.
 */

import type { Actor, FloorState } from "../types";
import type { AIResult } from "./types";
import type {
	ActiveSkillDefinition,
	ActiveSkillEffectDescriptor,
	SkillDefinition,
} from "../../skills";
import { getAdjacentIndices8 } from "../engineUtils";

const HP_DEFENSIVE_THRESHOLD = 0.4;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function evaluateNpcSkill(
	npc: Actor,
	getSkillDef: (id: string) => SkillDefinition | undefined,
	nearestEnemy: Actor | undefined,
	dist: number,
	floorState: FloorState,
	walkableMask: Uint8Array,
	width: number,
	height: number,
): AIResult | null {
	const skillEntries = Object.entries(npc.skills ?? {});
	const hpFraction = npc.hp / npc.maxHp;

	// Phase 1: Defensive — heal_self when HP is critically low.
	if (hpFraction < HP_DEFENSIVE_THRESHOLD) {
		for (const [skillId, state] of skillEntries) {
			if (state.cooldownRemaining !== 0) continue;
			const def = resolveActiveDef(skillId, getSkillDef);
			if (!def || def.targetType !== "none") continue;
			const effects = effectsAtRank(def, state.rank);
			if (effects.some((e) => e.type === "heal_self")) {
				return { kind: "skill", skillId };
			}
		}
	}

	// Phase 2: Self-buff — apply_shield or pure self-status when any enemy is visible.
	if (nearestEnemy) {
		for (const [skillId, state] of skillEntries) {
			if (state.cooldownRemaining !== 0) continue;
			const def = resolveActiveDef(skillId, getSkillDef);
			if (!def || def.targetType !== "none") continue;
			const effects = effectsAtRank(def, state.rank);
			if (isSelfBuff(effects)) {
				return { kind: "skill", skillId };
			}
		}
	}

	// Phase 3: Approach — gap-closing skills when not yet adjacent.
	if (nearestEnemy && dist >= 2) {
		for (const [skillId, state] of skillEntries) {
			if (state.cooldownRemaining !== 0) continue;
			const def = resolveActiveDef(skillId, getSkillDef);
			if (!def || def.range === undefined || dist > def.range) continue;
			const effects = effectsAtRank(def, state.rank);

			if (def.targetType === "actor" && effects.some((e) => e.type === "charge_attack")) {
				return { kind: "skill", skillId, targetActorId: nearestEnemy.id };
			}

			if (
				def.targetType === "tile" &&
				effects.some((e) => e.type === "leap_attack" || e.type === "shadow_step")
			) {
				const landingTile = findLandingTile(
					nearestEnemy.idx,
					npc.idx,
					floorState,
					walkableMask,
					width,
					height,
				);
				if (landingTile !== undefined) {
					return { kind: "skill", skillId, targetTileIdx: landingTile };
				}
			}
		}
	}

	// Phase 4: Combat — actor or tile targeted skills in range (excluding approach skills).
	if (nearestEnemy) {
		for (const [skillId, state] of skillEntries) {
			if (state.cooldownRemaining !== 0) continue;
			const def = resolveActiveDef(skillId, getSkillDef);
			if (!def || def.range === undefined || dist > def.range) continue;
			const effects = effectsAtRank(def, state.rank);

			if (def.targetType === "actor") {
				if (effects.some((e) => e.type === "charge_attack")) continue; // handled in approach
				return { kind: "skill", skillId, targetActorId: nearestEnemy.id };
			}

			if (def.targetType === "tile") {
				if (effects.some((e) => e.type === "leap_attack" || e.type === "shadow_step"))
					continue;
				return { kind: "skill", skillId, targetTileIdx: nearestEnemy.idx };
			}
		}
	}

	// Phase 5: AoE self-cast — when the enemy is within the skill's effective radius.
	if (nearestEnemy) {
		for (const [skillId, state] of skillEntries) {
			if (state.cooldownRemaining !== 0) continue;
			const def = resolveActiveDef(skillId, getSkillDef);
			if (!def || def.targetType !== "none") continue;
			const effects = effectsAtRank(def, state.rank);
			if (!isAoe(effects)) continue;
			if (dist <= aoeRadius(effects)) {
				return { kind: "skill", skillId };
			}
		}
	}

	return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveActiveDef(
	skillId: string,
	getSkillDef: (id: string) => SkillDefinition | undefined,
): ActiveSkillDefinition | undefined {
	const def = getSkillDef(skillId);
	return def?.skillType === "active" ? (def as ActiveSkillDefinition) : undefined;
}

function effectsAtRank(
	def: ActiveSkillDefinition,
	rank: number,
): readonly ActiveSkillEffectDescriptor[] {
	const idx = Math.min(Math.max(rank - 1, 0), 2) as 0 | 1 | 2;
	return def.effectsByRank[idx];
}

/**
 * Self-buff: apply_shield (always worth using) OR all effects are apply_status
 * targeting only the caster (not aoe).
 */
function isSelfBuff(effects: readonly ActiveSkillEffectDescriptor[]): boolean {
	if (effects.some((e) => e.type === "apply_shield")) return true;
	return (
		effects.length > 0 && effects.every((e) => e.type === "apply_status" && e.target !== "aoe")
	);
}

/**
 * AoE: at least one effect deals area damage or applies a status in an AoE radius.
 */
function isAoe(effects: readonly ActiveSkillEffectDescriptor[]): boolean {
	return effects.some(
		(e) => e.type === "area_damage" || (e.type === "apply_status" && e.target === "aoe"),
	);
}

/**
 * Maximum effective radius across all area effects at this rank.
 * Defaults to 1 when no explicit radius is set.
 */
function aoeRadius(effects: readonly ActiveSkillEffectDescriptor[]): number {
	let max = 1;
	for (const e of effects) {
		if (e.type === "area_damage") max = Math.max(max, e.radiusTiles);
		else if (e.type === "apply_status" && e.target === "aoe")
			max = Math.max(max, e.aoeRadiusTiles ?? 1);
	}
	return max;
}

/**
 * Find a cardinal (4-direction) step that increases Chebyshev distance from
 * threatIdx. Returns undefined if no valid escape tile exists.
 * Used by ranged and skirmisher strategies when retreating from an enemy.
 */
export function findFleeStep(
	from: number,
	threatIdx: number,
	walkableMask: Uint8Array,
	floorState: { actorsById: Record<string, { idx: number; alive: boolean }> },
	width: number,
	height: number,
): number | undefined {
	const occupied = new Set(
		Object.values(floorState.actorsById)
			.filter((a) => a.alive && a.idx !== from)
			.map((a) => a.idx),
	);

	const threatX = threatIdx % width;
	const threatY = Math.floor(threatIdx / width);
	const fromX = from % width;

	const chebyshev = (idx: number) =>
		Math.max(Math.abs((idx % width) - threatX), Math.abs(Math.floor(idx / width) - threatY));

	const currentDist = chebyshev(from);

	const cardinals = [
		from - width, // north
		from + width, // south
		from - 1, // west
		from + 1, // east
	].filter((idx) => {
		if (idx < 0 || idx >= width * height) return false;
		// Prevent east/west wrap-around at row boundaries.
		if (Math.abs((idx % width) - fromX) > 1) return false;
		return walkableMask[idx] === 1 && !occupied.has(idx);
	});

	return cardinals
		.filter((idx) => chebyshev(idx) > currentDist)
		.sort((a, b) => chebyshev(b) - chebyshev(a))[0];
}

/**
 * Find the first walkable, unoccupied tile adjacent (8-direction) to the enemy
 * that the NPC could leap or step to. Returns undefined if no valid tile exists.
 */
function findLandingTile(
	enemyIdx: number,
	npcIdx: number,
	floorState: FloorState,
	walkableMask: Uint8Array,
	width: number,
	height: number,
): number | undefined {
	const occupied = new Set(
		Object.values(floorState.actorsById)
			.filter((a) => a.alive)
			.map((a) => a.idx),
	);
	const candidates = getAdjacentIndices8(enemyIdx, width, height);
	return candidates.find((t) => walkableMask[t] === 1 && !occupied.has(t) && t !== npcIdx);
}
