/**
 * Map constants and default config. Client maps TILE_TYPE to tileset indices; shared stays platform-agnostic.
 */

import type { MapGenConfig } from "./types";

/** Logical tile types for map generation. Client maps these to tileset indices. */
export const TILE_TYPE = {
	FLOOR: 0,
	WALL: 1,
	/** No tile (e.g. empty cell on wall layer) */
	EMPTY: -1,
	/** No ground (empty space; walls still border so player cannot leave bounds) */
	VOID: -2,
} as const;

export const DEFAULT_MAP_WIDTH = 50;
export const DEFAULT_MAP_HEIGHT = 50;

export const DEFAULT_DECORATION_WEIGHTS: Record<string, number> = {
	grass: 10,
	plant: 5,
	bush: 3,
	rock: 2,
};

/** Default scatter chance for non-path decorations (0–1). Used by baseLayers and API. */
export const DEFAULT_SCATTER_CHANCE = 0.28;

/** Default theme name for client tile mapping (e.g. green_forest). */
export const DEFAULT_FLOOR_THEME = "green_forest";

/** Default map algorithm: "bsp" (rooms) or "cave" (cellular automata). */
export const DEFAULT_MAP_ALGORITHM = "cave" as const;

/** Cave only: default initial floor chance for cellular automata (0.35–0.55). */
export const DEFAULT_CAVE_FLOOR_CHANCE = 0.45;

/** BSP only: default room inset from leaf bounds (1–3). */
export const DEFAULT_BSP_ROOM_INSET = 1;

/** Default target fraction of map cells that are void (0–0.5). Single source of truth for map gen. */
export const DEFAULT_SHAPE_VOID_TARGET = 0.2;

/** Default floor config for new games (no seed; seed is run seed + floor index). Same shape as FloorConfig. */
export const DEFAULT_FLOOR_CONFIG: Omit<MapGenConfig, "seed"> = {
	width: DEFAULT_MAP_WIDTH,
	height: DEFAULT_MAP_HEIGHT,
	theme: DEFAULT_FLOOR_THEME,
	algorithm: DEFAULT_MAP_ALGORITHM,
	caveFloorChance: DEFAULT_CAVE_FLOOR_CHANCE,
	bspRoomInset: DEFAULT_BSP_ROOM_INSET,
	decorationWeights: DEFAULT_DECORATION_WEIGHTS,
	scatterChance: DEFAULT_SCATTER_CHANCE,
	shapeVoidTarget: DEFAULT_SHAPE_VOID_TARGET,
};
