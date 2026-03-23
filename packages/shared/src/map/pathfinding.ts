/**
 * BFS pathfinding for monster AI.
 * Returns the index of the first step toward the target, or undefined if unreachable.
 * Fully deterministic — no random, no environment reads.
 */

import type { FloorState } from "../game/types";
import { getActorAtIdx, idxToXY, xyToIdx } from "../game/engineUtils";

/**
 * BFS from `fromIdx` toward `toIdx`.
 * Respects `walkableMask` and actor occupancy, but treats `toIdx` as passable
 * even if occupied (so monsters can path toward the hero).
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

	const CARDINAL = [-width, width, -1, 1] as const;

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

		for (let d = 0; d < 4; d++) {
			const delta = CARDINAL[d];
			const next = current + delta;

			// Bounds: left/right wrap guard
			if (d === 2 && x === 0) continue;
			if (d === 3 && x === width - 1) continue;
			if (next < 0 || next >= size) continue;

			if (prev[next] !== -1) continue;

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
