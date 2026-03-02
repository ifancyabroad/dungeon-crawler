/**
 * Deterministic water mask generation: contiguous lakes that never disconnect
 * the playable area from spawn.
 */

import { createRng } from "../rng";
import { TILE_TYPE } from "./config";
import { wouldStayConnected } from "./connectivity";

const WATER_BLOB_SEED_COUNT_MIN = 1;
const WATER_BLOB_SEED_COUNT_MAX = 3;
const WATER_BLOB_GROWTH_PROB = 0.55;
const WATER_BLOB_MAX_SIZE = 28;

/**
 * Build water mask as contiguous lakes: pick 1–3 seeds from playable (non-spawn) cells,
 * then grow each blob with BFS and probability. Only adds a cell if it would not disconnect
 * the playable area from spawn, so water never blocks off parts of the map.
 */
export function buildWaterMask(
	ground: number[][],
	wall: number[][],
	spawn: { x: number; y: number },
	seed: number,
): boolean[][] {
	const height = ground.length;
	const width = ground[0]?.length ?? 0;
	const waterMask: boolean[][] = Array.from({ length: height }, () => Array(width).fill(false));
	const rng = createRng(seed + 2);
	const eligible: [number, number][] = [];
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (ground[y][x] !== TILE_TYPE.FLOOR) continue;
			if (wall[y][x] === TILE_TYPE.WALL) continue;
			if (x === spawn.x && y === spawn.y) continue;
			eligible.push([x, y]);
		}
	}
	if (eligible.length === 0) return waterMask;
	const numSeeds =
		WATER_BLOB_SEED_COUNT_MIN +
		Math.floor(rng() * (WATER_BLOB_SEED_COUNT_MAX - WATER_BLOB_SEED_COUNT_MIN + 1));
	const used = new Set<string>();
	for (let s = 0; s < numSeeds; s++) {
		const idx = Math.floor(rng() * eligible.length);
		const [sx, sy] = eligible[idx];
		const key = `${sx},${sy}`;
		if (used.has(key)) continue;
		const queue: [number, number][] = [[sx, sy]];
		let size = 0;
		while (queue.length > 0 && size < WATER_BLOB_MAX_SIZE) {
			const [x, y] = queue.shift()!;
			const k = `${x},${y}`;
			if (used.has(k)) continue;
			if (x < 0 || x >= width || y < 0 || y >= height) continue;
			if (ground[y][x] !== TILE_TYPE.FLOOR || wall[y][x] === TILE_TYPE.WALL) continue;
			if (x === spawn.x && y === spawn.y) continue;
			if (!wouldStayConnected(ground, wall, waterMask, spawn, x, y)) continue;
			used.add(k);
			waterMask[y][x] = true;
			size++;
			for (const [dx, dy] of [
				[0, 1],
				[0, -1],
				[1, 0],
				[-1, 0],
			]) {
				if (rng() < WATER_BLOB_GROWTH_PROB) queue.push([x + dx, y + dy]);
			}
		}
	}
	return waterMask;
}
