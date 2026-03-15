/**
 * Map logical layers (from @app/shared) to tileset indices for Phaser rendering.
 * Presentation only; walkability is determined by shared isCellWalkable + blockedMask.
 */

import { TILE_TYPE, type FloorTheme } from "@app/shared";
import { getTileIndicesByThemeAndRole, getTileIndicesByThemeAndType } from "./tilesetRegistry";

/**
 * Deterministic hash of (seed, x, y) for pseudo-random but reproducible tile choice.
 * Produces a well-scattered distribution so tiles don't alternate in a visible pattern.
 */
function hashForTile(seed: number, x: number, y: number): number {
	let h = (seed + x * 374761393 + y * 668265263) >>> 0;
	h = ((h ^ (h >>> 16)) * 0x85ebca6b) >>> 0;
	h = ((h ^ (h >>> 13)) * 0xc2b2ae35) >>> 0;
	return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Pick a tile index from a list deterministically. With seed, uses hashForTile for
 * random-looking variety; without seed, falls back to position modulo for backward compat.
 */
function pickTile(indices: number[], x: number, y: number, width: number, seed?: number): number {
	if (indices.length === 0) return 0;
	const s = seed ?? 0;
	const i =
		seed !== undefined
			? hashForTile(s, x, y) % indices.length
			: (y * width + x) % indices.length;
	return indices[i] ?? indices[0];
}

/**
 * Ground layer: walls always on ground tiles (never on water).
 * Uses multiple ground/water tiles; optional seed gives random-looking but deterministic variety.
 */
export function toGroundTileIndices(
	ground: number[][],
	wall: number[][],
	waterMask: boolean[][],
	theme: FloorTheme,
	seed?: number,
): number[][] {
	const groundIndices = getTileIndicesByThemeAndType(theme, "ground");
	const waterIndices = getTileIndicesByThemeAndType(theme, "water");
	const fallback = groundIndices[0] ?? 0;

	return ground.map((row, y) =>
		row.map((cell, x) => {
			const w = row.length;
			if (cell !== TILE_TYPE.FLOOR || wall[y][x] === TILE_TYPE.WALL)
				return pickTile(groundIndices, x, y, w, seed) ?? fallback;
			if (waterMask[y][x] && waterIndices.length > 0)
				return pickTile(waterIndices, x, y, w, seed) ?? fallback;
			return pickTile(groundIndices, x, y, w, seed) ?? fallback;
		}),
	);
}

/**
 * Map shared decoration grid (logical types) to tileset indices by theme.
 * Accepts an optional seed for deterministic variety (same as ground/wall layers).
 */
export function decorationGridToTileIndices(
	decorationGrid: string[][],
	theme: FloorTheme,
	seed?: number,
): number[][] {
	const height = decorationGrid.length;
	const width = decorationGrid[0]?.length ?? 0;
	const result: number[][] = Array.from({ length: height }, () => Array(width).fill(-1));
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const type = decorationGrid[y][x];
			if (!type) continue;
			const indices = getTileIndicesByThemeAndType(theme, type);
			if (indices.length === 0) continue;
			result[y][x] = indices[hashForTile(seed ?? 0, x, y) % indices.length] ?? -1;
		}
	}
	return result;
}

/** Wall layer: wall tile or empty by theme. Optional seed gives random-looking but deterministic wall variety. */
export function toWallTileIndices(layer: number[][], theme: FloorTheme, seed?: number): number[][] {
	const wallIndices = getTileIndicesByThemeAndRole(theme, "wall");
	const fallback = wallIndices[0] ?? 0;
	return layer.map((row, y) =>
		row.map((cell, x) => {
			if (cell !== TILE_TYPE.WALL) return TILE_TYPE.EMPTY;
			return pickTile(wallIndices, x, y, row.length, seed) ?? fallback;
		}),
	);
}
