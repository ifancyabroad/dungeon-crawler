/**
 * Canonical floor configuration for all dungeon floors.
 *
 * Each entry defines a floor's generation parameters, visual theme, encounter pool,
 * vault eligibility, and special features. The seed is injected at runtime
 * (seed = gameSeed + floorIndex).
 *
 * Add more floors to the array to extend the dungeon. The last entry must have
 * bossRules set (or not) — the engine automatically suppresses the exit for the final floor.
 */

import type { FloorConfig } from "./types";
import {
	DEFAULT_BSP_PARAMS,
	DEFAULT_CAVE_PARAMS,
	DEFAULT_DECORATION_WEIGHTS,
	DEFAULT_SCATTER_CHANCE,
	DEFAULT_SHAPE_VOID_TARGET,
} from "./config";

export const FLOOR_CONFIGS: FloorConfig[] = [
	// ── Floor 1: Green Forest — cave, intro difficulty ──────────────────────
	{
		theme: "green_forest",
		floorDepth: 1,
		width: 50,
		height: 50,
		shapeVoidTarget: DEFAULT_SHAPE_VOID_TARGET,
		algorithm: "cave",
		algorithmParams: { ...DEFAULT_CAVE_PARAMS },
		decorationWeights: { ...DEFAULT_DECORATION_WEIGHTS },
		scatterChance: DEFAULT_SCATTER_CHANCE,
		waterEnabled: true,
		encounterTable: [
			{ encounterId: "goblin_patrol", weight: 3 },
			{ encounterId: "goblin_guard", weight: 1 },
		],
		enemyDensity: 0.3,
		itemDensity: 0.0,
		vaultIds: ["goblin_shrine"],
		specialRoomFrequency: 0.2,
		bossRules: null,
	},

	// ── Floor 2: Orange Forest — BSP rooms, slightly harder ─────────────────
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
			{ encounterId: "goblin_patrol", weight: 2 },
			{ encounterId: "goblin_horde", weight: 1 },
		],
		enemyDensity: 0.4,
		itemDensity: 0.0,
		vaultIds: ["goblin_shrine"],
		specialRoomFrequency: 0.25,
		bossRules: null,
	},

	// ── Floor 3: Yellow Forest — hybrid, mid-game ────────────────────────────
	{
		theme: "yellow_forest",
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
		scatterChance: 0.32,
		waterEnabled: true,
		encounterTable: [
			{ encounterId: "goblin_horde", weight: 2 },
			{ encounterId: "goblin_patrol", weight: 1 },
		],
		enemyDensity: 0.45,
		itemDensity: 0.0,
		vaultIds: ["goblin_shrine", "boss_chamber"],
		specialRoomFrequency: 0.3,
		bossRules: null,
	},

	// ── Floor 4: Dark Forest — BSP large rooms, final floor with boss ────────
	{
		theme: "dark_forest",
		floorDepth: 4,
		width: 65,
		height: 65,
		shapeVoidTarget: 0.25,
		algorithm: "bsp",
		algorithmParams: { ...DEFAULT_BSP_PARAMS, roomInset: 3, minRoomSize: 6, maxRoomSize: 18 },
		decorationWeights: { ...DEFAULT_DECORATION_WEIGHTS, rock: 5, bush: 4 },
		scatterChance: 0.3,
		waterEnabled: false,
		encounterTable: [
			{ encounterId: "goblin_horde", weight: 3 },
			{ encounterId: "goblin_patrol", weight: 1 },
			{ encounterId: "boss_encounter", weight: 1, minDepth: 4 },
		],
		enemyDensity: 0.55,
		itemDensity: 0.0,
		vaultIds: ["boss_chamber"],
		specialRoomFrequency: 0.35,
		bossRules: {
			monsterId: "goblin",
			preferredRoomTag: "boss",
		},
	},
];
