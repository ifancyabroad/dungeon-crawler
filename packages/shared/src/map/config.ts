/**
 * Map constants and default config. Client maps TILE_TYPE to tileset indices; shared stays platform-agnostic.
 */

import type { FloorTheme } from "./themes";
import type { BspParams, CaveParams, FloorConfig } from "./types";

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
export const DEFAULT_FLOOR_THEME: FloorTheme = "green_forest";
export const DEFAULT_MAP_ALGORITHM = "cave" as const;

/**
 * Shared decoration weights used as the base for all floor configs.
 * Individual floors may spread and override specific keys.
 */
export const DEFAULT_DECORATION_WEIGHTS: Record<string, number> = {
	grass: 10,
	plant: 5,
	bush: 3,
	rock: 2,
};

export const DEFAULT_SCATTER_CHANCE = 0.28;
export const DEFAULT_SHAPE_VOID_TARGET = 0.2;

/**
 * Default algorithm param objects. Floors spread these and override specific fields
 * rather than duplicating every value.
 */
export const DEFAULT_BSP_PARAMS: BspParams = {
	roomInset: 1,
	minRoomSize: 4,
	maxRoomSize: 12,
};

export const DEFAULT_CAVE_PARAMS: CaveParams = {
	floorChance: 0.45,
	caIterations: 5,
	birthThreshold: 4,
};

/**
 * Fallback floor config used in tests and engine bootstrap.
 * All values are self-contained inline literals — this is a fixture, not a composition of
 * the shared defaults above. If you change a shared default, this does not change.
 */
export const DEFAULT_FLOOR_CONFIG: FloorConfig = {
	width: 50,
	height: 50,
	theme: "green_forest",
	floorDepth: 1,
	algorithm: "cave",
	algorithmParams: { floorChance: 0.45, caIterations: 5, birthThreshold: 4 },
	shapeVoidTarget: 0.2,
	decorationWeights: { grass: 10, plant: 5, bush: 3, rock: 2 },
	scatterChance: 0.28,
	waterEnabled: true,
	encounterTable: [],
	enemyDensity: 0.3,
	itemDensity: 0.0,
	vaultIds: [],
	specialRoomFrequency: 0.0,
	bossRules: null,
};
