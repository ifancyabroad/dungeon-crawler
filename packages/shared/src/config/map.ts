/**
 * Map generation literals — single place to tune defaults and floor progression.
 * Domain code imports from here; do not duplicate these values in map/.
 */

import type { BspParams, CaveParams, FloorConfig, FloorTheme } from "../map/types";

export const MAP_GEN_VERSION = 2;

/** Valid floor theme identifiers — must match `FloorTheme` in `map/types.ts`. */
export const FLOOR_THEMES = [
	"green_forest",
	"orange_forest",
	"yellow_forest",
	"dark_forest",
] as const satisfies readonly FloorTheme[];

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
export const DEFAULT_FLOOR_THEME = "green_forest" as const;
export const DEFAULT_MAP_ALGORITHM = "cave" as const;

export const DEFAULT_DECORATION_WEIGHTS: Record<string, number> = {
	grass: 10,
	plant: 5,
	bush: 3,
	rock: 2,
};

export const DEFAULT_SCATTER_CHANCE = 0.08;
export const DEFAULT_SHAPE_VOID_TARGET = 0.2;

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
 * Self-contained literals for a minimal valid floor.
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
	scatterChance: 0.08,
	waterEnabled: true,
	encounterTable: [],
	enemyDensity: 0.3,
	itemDensity: 0.0,
	vaultIds: [],
	specialRoomFrequency: 0.0,
	bossRules: null,
};

export const FLOOR_CONFIGS: FloorConfig[] = [
	{
		theme: "green_forest",
		floorDepth: 1,
		width: 50,
		height: 50,
		shapeVoidTarget: DEFAULT_SHAPE_VOID_TARGET,
		algorithm: "hybrid",
		algorithmParams: { caveFloorChance: 0.48, roomCount: 6, roomInset: 1 },
		decorationWeights: { ...DEFAULT_DECORATION_WEIGHTS },
		scatterChance: DEFAULT_SCATTER_CHANCE,
		waterEnabled: true,
		encounterTable: [
			{ encounterId: "beetle_swarm", weight: 2 },
			{ encounterId: "bat_colony", weight: 2 },
			{ encounterId: "insect_nest", weight: 3 },
		],
		enemyDensity: 0.3,
		itemDensity: 0.0,
		vaultIds: ["boss_chamber"],
		specialRoomFrequency: 0.2,
		bossRules: { npcId: "forest_guardian", preferredRoomTag: "boss" },
	},
	{
		theme: "orange_forest",
		floorDepth: 2,
		width: 55,
		height: 55,
		shapeVoidTarget: 0.22,
		algorithm: "bsp",
		algorithmParams: { ...DEFAULT_BSP_PARAMS, roomInset: 2, maxRoomSize: 14 },
		decorationWeights: { ...DEFAULT_DECORATION_WEIGHTS, rock: 4 },
		scatterChance: DEFAULT_SCATTER_CHANCE,
		waterEnabled: true,
		encounterTable: [
			{ encounterId: "goblin_war_party", weight: 3 },
			{ encounterId: "ooze_pit", weight: 2 },
			{ encounterId: "mixed_depths", weight: 3 },
		],
		enemyDensity: 0.4,
		itemDensity: 0.0,
		vaultIds: ["goblin_shrine", "boss_chamber"],
		specialRoomFrequency: 0.25,
		bossRules: { npcId: "minotaur", preferredRoomTag: "boss" },
	},
	{
		theme: "dark_forest",
		floorDepth: 3,
		width: 60,
		height: 60,
		shapeVoidTarget: 0.18,
		algorithm: "hybrid",
		algorithmParams: {
			caveFloorChance: 0.48,
			roomCount: 8,
			roomInset: 2,
		},
		decorationWeights: { ...DEFAULT_DECORATION_WEIGHTS, plant: 7, bush: 5 },
		scatterChance: 0.1,
		waterEnabled: true,
		encounterTable: [
			{ encounterId: "skeleton_patrol", weight: 3 },
			{ encounterId: "haunted_grove", weight: 3 },
			{ encounterId: "undead_horde", weight: 2 },
		],
		enemyDensity: 0.45,
		itemDensity: 0.0,
		vaultIds: ["boss_chamber"],
		specialRoomFrequency: 0.3,
		bossRules: { npcId: "reaper", preferredRoomTag: "boss" },
	},
	{
		theme: "yellow_forest",
		floorDepth: 4,
		width: 65,
		height: 65,
		shapeVoidTarget: 0.25,
		algorithm: "bsp",
		algorithmParams: { ...DEFAULT_BSP_PARAMS, roomInset: 3, minRoomSize: 6, maxRoomSize: 18 },
		decorationWeights: { ...DEFAULT_DECORATION_WEIGHTS, rock: 5, bush: 4 },
		scatterChance: 0.09,
		waterEnabled: false,
		encounterTable: [
			{ encounterId: "imp_swarm", weight: 3 },
			{ encounterId: "elemental_vanguard", weight: 3 },
			{ encounterId: "beholder_watch", weight: 2 },
		],
		enemyDensity: 0.55,
		itemDensity: 0.0,
		vaultIds: ["boss_chamber"],
		specialRoomFrequency: 0.35,
		bossRules: { npcId: "red_dragon", preferredRoomTag: "boss" },
	},
];

export const MAP_CONFIG = {
	tileType: TILE_TYPE,
	defaults: {
		width: DEFAULT_MAP_WIDTH,
		height: DEFAULT_MAP_HEIGHT,
		theme: DEFAULT_FLOOR_THEME,
		algorithm: DEFAULT_MAP_ALGORITHM,
		scatterChance: DEFAULT_SCATTER_CHANCE,
		shapeVoidTarget: DEFAULT_SHAPE_VOID_TARGET,
		bspParams: DEFAULT_BSP_PARAMS,
		caveParams: DEFAULT_CAVE_PARAMS,
		decorationWeights: DEFAULT_DECORATION_WEIGHTS,
		floor: DEFAULT_FLOOR_CONFIG,
	},
	themes: FLOOR_THEMES,
	floors: FLOOR_CONFIGS,
	version: {
		mapGen: MAP_GEN_VERSION,
	},
} as const;
