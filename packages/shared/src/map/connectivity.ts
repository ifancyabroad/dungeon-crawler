/**
 * Connectivity check for map generation: ensures placing a blocking cell
 * does not disconnect the playable area from spawn.
 */

import { TILE_TYPE } from "./config";

/**
 * Flood-fill from spawn through (playable - blocked - excludeCell). Returns true if the number of
 * cells reached equals the number of walkable cells, so the area stays connected when excludeCell is blocked.
 * blockedMask: any cell true is treated as non-walkable (water, colliding decorations, etc.).
 */
export function wouldStayConnected(
	ground: number[][],
	wall: number[][],
	blockedMask: boolean[][],
	spawn: { x: number; y: number },
	excludeX: number,
	excludeY: number,
): boolean {
	const height = ground.length;
	const width = ground[0]?.length ?? 0;
	let walkableCount = 0;
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (ground[y][x] !== TILE_TYPE.FLOOR || wall[y][x] === TILE_TYPE.WALL) continue;
			if (blockedMask[y][x]) continue;
			if (x === excludeX && y === excludeY) continue;
			walkableCount++;
		}
	}
	const reached = new Set<string>();
	const stack: [number, number][] = [[spawn.x, spawn.y]];
	while (stack.length > 0) {
		const [x, y] = stack.pop()!;
		const key = `${x},${y}`;
		if (reached.has(key)) continue;
		if (x < 0 || x >= width || y < 0 || y >= height) continue;
		if (ground[y][x] !== TILE_TYPE.FLOOR || wall[y][x] === TILE_TYPE.WALL) continue;
		if (blockedMask[y][x]) continue;
		if (x === excludeX && y === excludeY) continue;
		reached.add(key);
		stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
	}
	return reached.size === walkableCount;
}
