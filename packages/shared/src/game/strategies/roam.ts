/**
 * Roam idle strategy.
 *
 * The monster picks a random adjacent walkable unoccupied tile each turn.
 * Returns idle if all adjacent tiles are blocked.
 */

import type { AIContext, AIResult } from "./types";
import { getActorAtIdx, getAdjacentIndices } from "../engine";

export function runRoamAI(ctx: AIContext): AIResult {
	const { monster, walkableMask, floorState, width, height, rng } = ctx;

	const adjacent = getAdjacentIndices(monster.idx, width, height);
	const candidates = adjacent.filter(
		(idx) => walkableMask[idx] === 1 && !getActorAtIdx(floorState, idx),
	);

	if (candidates.length === 0) return { kind: "idle" };

	const pick = candidates[Math.floor(rng() * candidates.length)];
	return { kind: "move", toIdx: pick };
}
