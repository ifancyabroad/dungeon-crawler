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

export const DEFAULT_DECORATION_WEIGHTS: Record<string, number> = {
	grass: 10,
	plant: 5,
	bush: 3,
	rock: 2,
};

export const DEFAULT_SCATTER_CHANCE = 0.28;
export const DEFAULT_FLOOR_THEME: FloorTheme = "green_forest";
export const DEFAULT_MAP_ALGORITHM = "cave" as const;
export const DEFAULT_CAVE_FLOOR_CHANCE = 0.45;
export const DEFAULT_BSP_ROOM_INSET = 1;
export const DEFAULT_SHAPE_VOID_TARGET = 0.2;

export const DEFAULT_BSP_PARAMS: BspParams = {
	roomInset: 1,
	minRoomSize: 4,
	maxRoomSize: 12,
};

export const DEFAULT_CAVE_PARAMS: CaveParams = {
	floorChance: DEFAULT_CAVE_FLOOR_CHANCE,
	caIterations: 5,
	birthThreshold: 4,
};

/** Default floor config for tests and fallback scenarios. Satisfies the new FloorConfig shape. */
export const DEFAULT_FLOOR_CONFIG: FloorConfig = {
	width: DEFAULT_MAP_WIDTH,
	height: DEFAULT_MAP_HEIGHT,
	theme: DEFAULT_FLOOR_THEME,
	floorDepth: 1,
	algorithm: DEFAULT_MAP_ALGORITHM,
	algorithmParams: { ...DEFAULT_CAVE_PARAMS },
	shapeVoidTarget: DEFAULT_SHAPE_VOID_TARGET,
	decorationWeights: DEFAULT_DECORATION_WEIGHTS,
	scatterChance: DEFAULT_SCATTER_CHANCE,
	waterEnabled: true,
	encounterTable: [],
	enemyDensity: 0.3,
	itemDensity: 0.0,
	vaultIds: [],
	specialRoomFrequency: 0.0,
	bossRules: null,
};
