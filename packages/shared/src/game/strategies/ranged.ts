/**
 * Ranged combat strategy.
 *
 * Used by monsters that prefer distance over melee (e.g. goblin mage).
 *
 * Decision tree:
 * 1. No enemies visible and no last-known position → idle.
 * 2. Adjacent enemy → attempt to flee one step away; fall back to melee attack if stuck.
 * 3. Visible enemy: find the best off-cooldown ranged skill (range >= 2). If the enemy is
 *    within that skill's range, use it. Prefer actor-targeted skills over tile-targeted.
 * 4. Visible enemy but no skill ready or enemy out of range → move toward ideal distance
 *    (IDEAL_RANGE tiles), stopping short if already close enough.
 * 5. Last-known enemy position → BFS toward it; clear on arrival or if path blocked.
 * 6. Idle (hand off to idle strategy).
 */

import type { AIContext, AIResult, AITurnResult, MonsterAIState } from "./types";
import { getAdjacentIndices } from "../engine";
import { bfsNextStep } from "../../map/pathfinding";

/** Preferred stand-off distance in tiles (Chebyshev). */
const IDEAL_RANGE = 3;

export function runRangedAI(ctx: AIContext): AITurnResult {
	const {
		monster,
		aiState,
		effectiveFactions,
		visibleFromMonster,
		walkableMask,
		floorState,
		width,
		height,
		getSkillDef,
	} = ctx;
	const newAIState: MonsterAIState = { ...aiState };

	const myFaction = effectiveFactions[monster.id] ?? "hostile";
	const enemyFaction: "player" | "hostile" = myFaction === "hostile" ? "player" : "hostile";

	const enemies = Object.values(floorState.actorsById).filter(
		(a) => a.alive && a.id !== monster.id && effectiveFactions[a.id] === enemyFaction,
	);

	if (enemies.length === 0) {
		return { result: { kind: "idle" }, newAIState };
	}

	const chebyshev = (aIdx: number, bIdx: number) =>
		Math.max(
			Math.abs((aIdx % width) - (bIdx % width)),
			Math.abs(Math.floor(aIdx / width) - Math.floor(bIdx / width)),
		);

	const adjacent = getAdjacentIndices(monster.idx, width, height);

	// -----------------------------------------------------------------------
	// Step 2: Adjacent enemy — try to flee one step, otherwise fall back to attack
	// -----------------------------------------------------------------------
	const adjacentEnemy = enemies.find((a) => adjacent.includes(a.idx));
	if (adjacentEnemy) {
		const fleeStep = findFleeStep(
			monster.idx,
			adjacentEnemy.idx,
			walkableMask,
			floorState,
			width,
			height,
		);
		if (fleeStep !== undefined) {
			return { result: { kind: "move", toIdx: fleeStep }, newAIState };
		}
		// Cornered — can't flee, attack instead
		return { result: { kind: "attack", targetActorId: adjacentEnemy.id }, newAIState };
	}

	// -----------------------------------------------------------------------
	// Step 3 & 4: Visible enemies
	// -----------------------------------------------------------------------
	const visibleEnemies = enemies.filter((a) => visibleFromMonster[a.idx] === 1);

	if (visibleEnemies.length > 0) {
		// Pick the nearest visible enemy as primary target
		const nearest = visibleEnemies.reduce((best, a) =>
			chebyshev(monster.idx, a.idx) < chebyshev(monster.idx, best.idx) ? a : best,
		);
		newAIState.lastKnownEnemyIdx = nearest.idx;

		// Find the best ranged skill: off-cooldown, range >= 2, active
		type RangedSkillInfo = { skillId: string; range: number; targetType: string };
		let bestSkill: RangedSkillInfo | undefined;

		if (getSkillDef) {
			for (const [skillId, skillState] of Object.entries(monster.skills ?? {})) {
				if (skillState.cooldownRemaining !== 0) continue;
				const def = getSkillDef(skillId);
				if (!def || def.skillType !== "active") continue;
				if ((def.range ?? 0) < 2) continue;
				if (def.targetType === "none") continue;
				// Prefer higher range, then actor-targeted over tile-targeted
				if (
					!bestSkill ||
					(def.range ?? 0) > bestSkill.range ||
					(def.range === bestSkill.range &&
						def.targetType === "actor" &&
						bestSkill.targetType !== "actor")
				) {
					bestSkill = { skillId, range: def.range ?? 0, targetType: def.targetType };
				}
			}
		}

		const dist = chebyshev(monster.idx, nearest.idx);

		if (bestSkill && dist <= bestSkill.range) {
			// Enemy is within skill range — fire
			const skillResult: AIResult =
				bestSkill.targetType === "actor"
					? { kind: "skill", skillId: bestSkill.skillId, targetActorId: nearest.id }
					: { kind: "skill", skillId: bestSkill.skillId, targetTileIdx: nearest.idx };
			return { result: skillResult, newAIState };
		}

		// Skill on cooldown or enemy out of range — reposition toward ideal distance
		if (dist > IDEAL_RANGE) {
			// Too far — move closer
			const step = bfsNextStep(
				monster.idx,
				nearest.idx,
				walkableMask,
				floorState,
				width,
				height,
			);
			if (step !== undefined) {
				return { result: { kind: "move", toIdx: step }, newAIState };
			}
		}
		// Already at ideal range or can't move closer — hold position and wait for cooldown
		return { result: { kind: "idle" }, newAIState };
	}

	// -----------------------------------------------------------------------
	// Step 5: Last-known enemy position
	// -----------------------------------------------------------------------
	if (newAIState.lastKnownEnemyIdx !== undefined) {
		const target = newAIState.lastKnownEnemyIdx;
		if (monster.idx === target) {
			newAIState.lastKnownEnemyIdx = undefined;
		} else {
			const step = bfsNextStep(monster.idx, target, walkableMask, floorState, width, height);
			if (step !== undefined) {
				return { result: { kind: "move", toIdx: step }, newAIState };
			}
			newAIState.lastKnownEnemyIdx = undefined;
		}
	}

	return { result: { kind: "idle" }, newAIState };
}

/**
 * Find a single BFS step that moves `from` away from `threatIdx`.
 * Returns the step index if one is found, or undefined if the monster is cornered.
 */
function findFleeStep(
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

	// Try all four cardinal directions, picking the one furthest from the threat
	const cardinals = [
		from - width, // north
		from + width, // south
		from - 1, // west
		from + 1, // east
	].filter((idx) => {
		if (idx < 0 || idx >= width * height) return false;
		// Prevent east/west wrap-around
		if (Math.abs((idx % width) - fromX) > 1) return false;
		return walkableMask[idx] === 1 && !occupied.has(idx);
	});

	const best = cardinals
		.filter((idx) => chebyshev(idx) > currentDist)
		.sort((a, b) => chebyshev(b) - chebyshev(a))[0];

	return best;
}
