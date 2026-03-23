/**
 * Frightened combat strategy.
 *
 * Applied via combatStrategyOverride when a monster has the FRIGHTENED status effect.
 * Faction-agnostic: derives enemies from effectiveFactions so it works correctly for
 * any actor regardless of which side they are on.
 *
 * Decision tree:
 * 1. No visible enemy → { kind: "idle" } to hand off to the idle strategy.
 * 2. Enemy visible, no free adjacent tiles → idle (blocked).
 * 3. Enemy visible, free tiles exist → move to the adjacent tile with the greatest
 *    Chebyshev distance from the nearest visible enemy.
 */

import type { AIContext, AITurnResult, MonsterAIState } from "../monsterAI";
import { getActorAtIdx, getAdjacentIndices } from "../engine";

export function runFrightenedAI(ctx: AIContext): AITurnResult {
	const {
		monster,
		aiState,
		effectiveFactions,
		visibleFromMonster,
		walkableMask,
		floorState,
		width,
		height,
	} = ctx;
	const newAIState: MonsterAIState = { ...aiState };

	const myFaction = effectiveFactions[monster.id] ?? "hostile";
	const enemyFaction: "player" | "hostile" = myFaction === "hostile" ? "player" : "hostile";

	const visibleEnemies = Object.values(floorState.actorsById).filter(
		(a) =>
			a.alive &&
			a.id !== monster.id &&
			effectiveFactions[a.id] === enemyFaction &&
			visibleFromMonster[a.idx] === 1,
	);

	// 1. No visible enemy → defer to idle strategy
	if (visibleEnemies.length === 0) {
		return { result: { kind: "idle" }, newAIState };
	}

	const adjacent = getAdjacentIndices(monster.idx, width, height);
	const freeTiles = adjacent.filter(
		(idx) => walkableMask[idx] === 1 && !getActorAtIdx(floorState, idx),
	);

	// 2. Surrounded — cannot flee
	if (freeTiles.length === 0) {
		return { result: { kind: "idle" }, newAIState };
	}

	// 3. Flee from nearest visible enemy
	const chebyshev = (aIdx: number, bIdx: number) =>
		Math.max(
			Math.abs((aIdx % width) - (bIdx % width)),
			Math.abs(Math.floor(aIdx / width) - Math.floor(bIdx / width)),
		);

	const nearestEnemy = visibleEnemies.reduce((best, a) =>
		chebyshev(monster.idx, a.idx) < chebyshev(monster.idx, best.idx) ? a : best,
	);

	const enemyCol = nearestEnemy.idx % width;
	const enemyRow = Math.floor(nearestEnemy.idx / width);
	const farthest = freeTiles.reduce((best, idx) => {
		const col = idx % width;
		const row = Math.floor(idx / width);
		const dist = Math.max(Math.abs(col - enemyCol), Math.abs(row - enemyRow));
		const bestCol = best % width;
		const bestRow = Math.floor(best / width);
		const bestDist = Math.max(Math.abs(bestCol - enemyCol), Math.abs(bestRow - enemyRow));
		return dist > bestDist ? idx : best;
	});

	return { result: { kind: "move", toIdx: farthest }, newAIState };
}
