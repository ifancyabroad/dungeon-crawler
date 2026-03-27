/**
 * Roam idle strategy.
 *
 * The NPC picks a random adjacent walkable unoccupied tile each turn.
 * Returns idle if all adjacent tiles are blocked.
 */

import type { AIContext, AIResult } from "./types";
import { getActorAtIdx, getAdjacentIndices8, idxToXY, isSqueezeBlocked } from "../engine";

export function runRoamAI(ctx: AIContext): AIResult {
	const { npc, walkableMask, floorState, width, height, rng } = ctx;
	const { x: ox, y: oy } = idxToXY(npc.idx, width);

	const candidates = getAdjacentIndices8(npc.idx, width, height).filter((idx) => {
		if (walkableMask[idx] !== 1 || getActorAtIdx(floorState, idx)) return false;
		const dx = (idx % width) - ox;
		const dy = Math.floor(idx / width) - oy;
		if (dx !== 0 && dy !== 0 && isSqueezeBlocked(ox, oy, dx, dy, width, height, walkableMask))
			return false;
		return true;
	});

	if (candidates.length === 0) return { kind: "idle" };

	const pick = candidates[Math.floor(rng() * candidates.length)]!;
	return { kind: "move", toIdx: pick };
}
