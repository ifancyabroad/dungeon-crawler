/**
 * Frightened AI strategy.
 *
 * Applied via strategyOverride when a monster has the FRIGHTENED status effect.
 * The monster tries to maximise its distance from the hero each turn.
 *
 * Decision tree:
 * 1. Hero not visible → roam randomly (same as melee step 4).
 * 2. Hero visible → among walkable unoccupied adjacent tiles, pick the one with
 *    the greatest Chebyshev distance from the hero; if none free → idle.
 */

import type { AIContext, AITurnResult, MonsterAIState } from "../monsterAI";
import { getActorAtIdx, getAdjacentIndices } from "../engine";

export function runFrightenedAI(ctx: AIContext): AITurnResult {
	const {
		monster,
		aiState,
		hero,
		visibleFromMonster,
		walkableMask,
		floorState,
		width,
		height,
		rng,
	} = ctx;
	const newAIState: MonsterAIState = { ...aiState };

	const adjacent = getAdjacentIndices(monster.idx, width, height);
	const freeTiles = adjacent.filter(
		(idx) => walkableMask[idx] === 1 && !getActorAtIdx(floorState, idx),
	);

	// 1. Hero not in LoS → roam
	if (visibleFromMonster[hero.idx] !== 1) {
		if (freeTiles.length > 0) {
			const pick = freeTiles[Math.floor(rng() * freeTiles.length)];
			return { result: { kind: "move", toIdx: pick }, newAIState };
		}
		return { result: { kind: "idle" }, newAIState };
	}

	// 2. Hero visible → flee: pick adjacent tile farthest from hero
	if (freeTiles.length === 0) {
		return { result: { kind: "idle" }, newAIState };
	}

	const heroCol = hero.idx % width;
	const heroRow = Math.floor(hero.idx / width);
	const farthest = freeTiles.reduce((best, idx) => {
		const col = idx % width;
		const row = Math.floor(idx / width);
		const dist = Math.max(Math.abs(col - heroCol), Math.abs(row - heroRow));
		const bestCol = best % width;
		const bestRow = Math.floor(best / width);
		const bestDist = Math.max(Math.abs(bestCol - heroCol), Math.abs(bestRow - heroRow));
		return dist > bestDist ? idx : best;
	});
	return { result: { kind: "move", toIdx: farthest }, newAIState };
}
