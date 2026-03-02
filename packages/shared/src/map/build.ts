/**
 * Deterministic map layer builders. No RNG; all functions are pure.
 * Used by API and client for procedural map data.
 */

import { TILE_TYPE } from "./config";

/** Build ground layer: all cells floor. */
export function buildGroundLayer(width: number, height: number): number[][] {
	return Array.from({ length: height }, () =>
		Array.from({ length: width }, () => TILE_TYPE.FLOOR),
	);
}

/** Build wall layer: border = wall, interior = EMPTY. */
export function buildWallLayer(width: number, height: number): number[][] {
	const rows: number[][] = [];
	for (let y = 0; y < height; y++) {
		const row: number[] = [];
		for (let x = 0; x < width; x++) {
			const isBorder = y === 0 || y === height - 1 || x === 0 || x === width - 1;
			row.push(isBorder ? TILE_TYPE.WALL : TILE_TYPE.EMPTY);
		}
		rows.push(row);
	}
	return rows;
}
