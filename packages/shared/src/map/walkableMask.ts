/**
 * Canonical walkability mask: single function to compute Uint8Array mask from base layers + overrides.
 * mask[idx] === 1 means walkable; 0 means blocked.
 * No boolean[][] allocation; override tiles are treated as not walkable (single place).
 */

import type { BaseLayerFloor } from "./baseLayers";
import { isCellWalkable } from "./walkability";

/**
 * Tile IDs that are walkable when placed as tile overrides.
 * Loot piles (825, 827) are passable so the hero can step onto them to trigger pickup.
 * Chests are placed on floor cells and are always walkable via underlying terrain.
 */
const WALKABLE_OVERRIDE_TILES = new Set([825, 827]);

/**
 * Override tile walkability. Loot pile tiles (825 = gold-only, 827 = items) are
 * passable so the hero can step onto them to trigger the pickup interaction.
 * All other override tiles (e.g. doors, traps) remain blocked by default.
 */
function isTileIdWalkable(tileId: number): boolean {
	return WALKABLE_OVERRIDE_TILES.has(tileId);
}

/**
 * Compute the walkable mask for one floor from base layers and optional tile overrides.
 * Cell index = y * width + x. tileOverrides uses string keys only (canonical form).
 * Returns Uint8Array of length width*height; 1 = walkable, 0 = blocked.
 */
export function computeWalkableMaskForFloor(
	base: BaseLayerFloor,
	tileOverrides: Record<string, number>,
): Uint8Array {
	const { ground, wall, blockedMask, width, height } = base;
	const mask = new Uint8Array(width * height);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const idx = y * width + x;
			const overrideTile = tileOverrides[String(idx)];
			const walkable =
				overrideTile !== undefined
					? isTileIdWalkable(overrideTile)
					: isCellWalkable(ground, wall, blockedMask, x, y);
			mask[idx] = walkable ? 1 : 0;
		}
	}
	return mask;
}
