/**
 * Canonical floor configuration for all dungeon floors.
 * Edit this file to tune floor themes, map sizes, generation parameters, and monster spawns.
 * One entry per floor, in order. The last floor has no exit (enforced by the engine).
 */

import type { FloorConfig } from "../game/types";
import {
	DEFAULT_BSP_ROOM_INSET,
	DEFAULT_CAVE_FLOOR_CHANCE,
	DEFAULT_DECORATION_WEIGHTS,
	DEFAULT_SCATTER_CHANCE,
	DEFAULT_SHAPE_VOID_TARGET,
} from "./config";

export const FLOOR_CONFIGS: FloorConfig[] = [
	// Floor 1 — Green Forest (cave, medium)
	{
		theme: "green_forest",
		algorithm: "cave",
		width: 50,
		height: 50,
		caveFloorChance: DEFAULT_CAVE_FLOOR_CHANCE,
		bspRoomInset: DEFAULT_BSP_ROOM_INSET,
		decorationWeights: DEFAULT_DECORATION_WEIGHTS,
		scatterChance: DEFAULT_SCATTER_CHANCE,
		shapeVoidTarget: DEFAULT_SHAPE_VOID_TARGET,
		spawns: [{ monsterId: "goblin", weight: 1 }],
	},
	// Floor 2 — Orange Forest (BSP, slightly larger)
	{
		theme: "orange_forest",
		algorithm: "bsp",
		width: 55,
		height: 55,
		caveFloorChance: DEFAULT_CAVE_FLOOR_CHANCE,
		bspRoomInset: 2,
		decorationWeights: { ...DEFAULT_DECORATION_WEIGHTS, rock: 4 },
		scatterChance: DEFAULT_SCATTER_CHANCE,
		shapeVoidTarget: 0.22,
		spawns: [{ monsterId: "goblin", weight: 1 }],
	},
	// Floor 3 — Yellow Forest (cave, larger)
	{
		theme: "yellow_forest",
		algorithm: "cave",
		width: 60,
		height: 60,
		caveFloorChance: 0.48,
		bspRoomInset: DEFAULT_BSP_ROOM_INSET,
		decorationWeights: { ...DEFAULT_DECORATION_WEIGHTS, plant: 7, bush: 5 },
		scatterChance: 0.32,
		shapeVoidTarget: 0.18,
		spawns: [{ monsterId: "goblin", weight: 1 }],
	},
	// Floor 4 — Dark Forest (BSP, largest; no exit spawned)
	{
		theme: "dark_forest",
		algorithm: "bsp",
		width: 65,
		height: 65,
		caveFloorChance: DEFAULT_CAVE_FLOOR_CHANCE,
		bspRoomInset: 3,
		decorationWeights: { ...DEFAULT_DECORATION_WEIGHTS, rock: 5, bush: 4 },
		scatterChance: 0.3,
		shapeVoidTarget: 0.25,
		spawns: [{ monsterId: "goblin", weight: 1 }],
	},
];
