/**
 * Map constants and logical tile types.
 * Client maps TILE_TYPE to tileset indices; shared stays platform-agnostic.
 */

/** Logical tile types for map generation. Client maps these to tileset indices. */
export const TILE_TYPE = {
	FLOOR: 0,
	WALL: 1,
	/** No tile (e.g. empty cell on wall layer) */
	EMPTY: -1,
} as const;

export const DEFAULT_MAP_WIDTH = 15;
export const DEFAULT_MAP_HEIGHT = 15;
