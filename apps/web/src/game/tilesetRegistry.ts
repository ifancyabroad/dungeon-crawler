/**
 * Single source of truth for the Roguelike Remastered tileset (32×32).
 * Tile indices are row-major: index = row * tilesPerRow + col.
 * Only indices used in the game are defined here.
 */

export const TILE_WIDTH = 32;
export const TILE_HEIGHT = 32;
export const TILESET_KEY = "roguelike-tileset";

/** Terrain: logical name → one or more tile indices in the sheet */
export const TERRAIN = {
	/** Floor / ground tiles (walkable) */
	FLOOR: [235, 236, 237],
	/** Wall tiles (block movement) */
	WALL: [109, 110, 111, 130, 131, 132],
	WATER: [298],
	LAVA: [307],
} as const;

/** All tile indices that block movement. Used with layer.setCollisionByIndex(). */
export const COLLIDING_INDICES: number[] = [...TERRAIN.WALL];

/** Entity tile indices for placement (hero, monsters). Same 32×32 grid in the sheet. */
export const ENTITIES = {
	HERO: 739,
	RAT: 619,
	GOBLIN: 677,
} as const;
