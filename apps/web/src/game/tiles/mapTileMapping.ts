/**
 * Map logical layers (from @app/shared) to tileset indices for Phaser rendering.
 * Presentation only; walkability is determined by shared isCellWalkable + blockedMask.
 */

import { TILE_TYPE } from "@app/shared";
import { getTileIndicesByThemeAndRole, getTileIndicesByThemeAndType } from "./tilesetRegistry";

/**
 * Ground layer: walls always on ground tiles (never on water).
 * Water only where waterMask; otherwise ground tile by position.
 */
export function toGroundTileIndices(
	ground: number[][],
	wall: number[][],
	waterMask: boolean[][],
	theme: string,
): number[][] {
	const groundIndices = getTileIndicesByThemeAndType(theme, "ground");
	const waterIndices = getTileIndicesByThemeAndType(theme, "water");
	const defaultGround = groundIndices[0] ?? 0;
	const waterTile = waterIndices[0] ?? defaultGround;

	return ground.map((row, y) =>
		row.map((cell, x) => {
			if (cell !== TILE_TYPE.FLOOR) return defaultGround;
			if (wall[y][x] === TILE_TYPE.WALL) return defaultGround;
			if (waterMask[y][x] && waterIndices.length > 0) return waterTile;
			const idx = (y * row.length + x) % groundIndices.length;
			return groundIndices[idx] ?? defaultGround;
		}),
	);
}

/**
 * Map shared decoration grid (logical types) to tileset indices by theme.
 */
export function decorationGridToTileIndices(decorationGrid: string[][], theme: string): number[][] {
	const height = decorationGrid.length;
	const width = decorationGrid[0]?.length ?? 0;
	const result: number[][] = Array.from({ length: height }, () => Array(width).fill(-1));
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const type = decorationGrid[y][x];
			if (!type) continue;
			const indices = getTileIndicesByThemeAndType(theme, type);
			const index = indices[Math.floor((y * width + x) % indices.length)] ?? -1;
			result[y][x] = index;
		}
	}
	return result;
}

/** Wall layer: wall tile or empty by theme. */
export function toWallTileIndices(layer: number[][], theme: string): number[][] {
	const wallIndices = getTileIndicesByThemeAndRole(theme, "wall");
	const wallIndex = wallIndices[0] ?? 0;
	return layer.map((row) =>
		row.map((cell) => (cell === TILE_TYPE.WALL ? wallIndex : TILE_TYPE.EMPTY)),
	);
}
