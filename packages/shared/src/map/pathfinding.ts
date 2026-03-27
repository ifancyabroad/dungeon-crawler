/**
 * BFS pathfinding for NPC AI.
 * Returns the index of the first step toward the target, or undefined if unreachable.
 * Fully deterministic — no random, no environment reads.
 */

import type { FloorState } from "../game/types";
import { getActorAtIdx, idxToXY, isSqueezeBlocked } from "../game/engineUtils";

/**
 * BFS from `fromIdx` toward `toIdx`.
 * Respects `walkableMask` and actor occupancy, but treats `toIdx` as passable
 * even if occupied (so NPCs can path toward the hero).
 * Returns the first step index, or undefined if no path exists.
 */
export function bfsNextStep(
	fromIdx: number,
	toIdx: number,
	walkableMask: Uint8Array,
	floorState: FloorState,
	width: number,
	height: number,
): number | undefined {
	if (fromIdx === toIdx) return undefined;

	const size = width * height;
	// prev[idx] = index we came from (-1 = unvisited)
	const prev = new Int32Array(size).fill(-1);
	prev[fromIdx] = fromIdx;

	const queue: number[] = [fromIdx];
	let head = 0;

	const NEIGHBORS: [number, number][] = [
		[0, -1],
		[0, 1],
		[-1, 0],
		[1, 0], // cardinal
		[-1, -1],
		[1, -1],
		[-1, 1],
		[1, 1], // diagonal
	];

	while (head < queue.length) {
		const current = queue[head++];

		if (current === toIdx) {
			// Trace back to get the first step
			let step = current;
			while (prev[step] !== fromIdx) {
				step = prev[step];
			}
			return step;
		}

		const { x, y } = idxToXY(current, width);

		for (const [dx, dy] of NEIGHBORS) {
			const nx = x + dx,
				ny = y + dy;
			if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
			const next = ny * width + nx;
			if (prev[next] !== -1) continue;
			if (dx !== 0 && dy !== 0 && isSqueezeBlocked(x, y, dx, dy, width, height, walkableMask))
				continue;

			// Allow destination even if occupied; block other occupied cells
			const isDestination = next === toIdx;
			const walkable = walkableMask[next] === 1;
			const occupied = !isDestination && !!getActorAtIdx(floorState, next);

			if (!walkable || occupied) continue;

			prev[next] = current;
			queue.push(next);
		}
	}

	return undefined;
}
