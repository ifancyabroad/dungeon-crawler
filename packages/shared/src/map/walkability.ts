/**
 * Walkability: canonical rule for whether a cell can be walked on.
 * Used by both client (to allow/disallow move input) and server (to validate move actions).
 */

import { TILE_TYPE } from "./config";

/**
 * Returns true if the cell (x, y) is walkable: in bounds, floor, not wall, not in blockedMask.
 * blockedMask = water + blocking decorations (same as buildWaterMask + buildDecorationLayer result).
 * Server and client must use this with the same logical map state to get the same result.
 */
export function isCellWalkable(
	ground: number[][],
	wall: number[][],
	blockedMask: boolean[][],
	x: number,
	y: number,
): boolean {
	const height = ground.length;
	const width = ground[0]?.length ?? 0;
	if (x < 0 || x >= width || y < 0 || y >= height) return false;
	if (ground[y][x] !== TILE_TYPE.FLOOR) return false;
	if (wall[y][x] === TILE_TYPE.WALL) return false;
	if (blockedMask[y][x]) return false;
	return true;
}
