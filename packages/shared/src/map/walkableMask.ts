/**
 * Canonical walkability mask: single function to compute Uint8Array mask from base layers + overrides.
 * mask[idx] === 1 means walkable; 0 means blocked.
 * No boolean[][] allocation; override tiles are treated as not walkable (single place).
 */

import type { BaseLayerFloor } from "./baseLayers";
import { isCellWalkable } from "./walkability";

/** Override tile walkability: for now no override tile is walkable. Centralized here. */
function isTileIdWalkable(_tileId: number): boolean {
	return false;
}

/**
 * Compute the walkable mask for one floor from base layers and optional tile overrides.
 * Cell index = y * width + x. tileOverrides may have number or string keys (JSON).
 * Returns Uint8Array of length width*height; 1 = walkable, 0 = blocked.
 */
export function computeWalkableMaskForFloor(
	base: BaseLayerFloor,
	tileOverrides: Record<number | string, number>,
): Uint8Array {
	const { ground, wall, blockedMask, width, height } = base;
	const mask = new Uint8Array(width * height);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const idx = y * width + x;
			const overrideTile = tileOverrides[idx] ?? tileOverrides[String(idx)];
			const walkable =
				overrideTile !== undefined
					? isTileIdWalkable(overrideTile)
					: isCellWalkable(ground, wall, blockedMask, x, y);
			mask[idx] = walkable ? 1 : 0;
		}
	}
	return mask;
}
