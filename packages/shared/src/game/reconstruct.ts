/**
 * Regenerate base map layers from seed + floor configs (deterministic).
 * Walkability derived from base layers + tile overrides; no 2D arrays persisted.
 */

import { createRng } from "../rng";
import { buildDecorationLayer, buildWaterMask, generateMap, isCellWalkable } from "../map";
import type { MapGenConfig } from "../map/types";
import type { FloorConfig } from "./types";
import { MAP_GEN_VERSION } from "./types";

const DEFAULT_DECORATION_WEIGHTS: Record<string, number> = {
	grass: 10,
	plant: 5,
	bush: 3,
	rock: 2,
};
const DEFAULT_SCATTER_CHANCE = 0.28;

export interface BaseLayerFloor {
	ground: number[][];
	wall: number[][];
	blockedMask: boolean[][];
	width: number;
	height: number;
	spawn: { x: number; y: number };
}

/**
 * Deterministic regeneration of base map layers per floor.
 * Uses mapGenVersion for future algorithm variants; floor seed = seed + floorIndex.
 */
export function regenerateBaseMaps(
	seed: number,
	floorConfigs: FloorConfig[],
	mapGenVersion: number,
): BaseLayerFloor[] {
	if (mapGenVersion !== MAP_GEN_VERSION) {
		throw new Error(`Unsupported mapGenVersion: ${mapGenVersion}`);
	}
	const result: BaseLayerFloor[] = [];
	for (let i = 0; i < floorConfigs.length; i++) {
		const config: MapGenConfig = {
			...floorConfigs[i],
			seed: seed + i,
		};
		const rng = createRng(config.seed);
		const { ground, wall, spawn, pathLayer } = generateMap(config, rng);
		const waterMask = buildWaterMask(ground, wall, spawn, config.seed);
		const weights = config.decorationWeights ?? DEFAULT_DECORATION_WEIGHTS;
		const scatterChance = config.scatterChance ?? DEFAULT_SCATTER_CHANCE;
		const { blockedMask } = buildDecorationLayer(
			ground,
			wall,
			pathLayer,
			waterMask,
			spawn,
			config.seed,
			weights,
			scatterChance,
		);
		const width = config.width;
		const height = config.height;
		result.push({ ground, wall, blockedMask, width, height, spawn });
	}
	return result;
}

/**
 * Build walkability grid for one floor from base layers and optional tile overrides.
 * Cell index = y * width + x. tileOverrides may have number or string keys (JSON).
 */
export function getWalkableForFloor(
	base: BaseLayerFloor,
	tileOverrides: Record<number | string, number>,
): boolean[][] {
	const { ground, wall, blockedMask, width, height } = base;
	const walkable: boolean[][] = [];
	for (let y = 0; y < height; y++) {
		walkable[y] = [];
		for (let x = 0; x < width; x++) {
			const baseWalkable = isCellWalkable(ground, wall, blockedMask, x, y);
			const idx = y * width + x;
			const overrideTile = tileOverrides[idx] ?? tileOverrides[String(idx)];
			walkable[y][x] =
				overrideTile !== undefined ? isTileIdWalkable(overrideTile) : baseWalkable;
		}
	}
	return walkable;
}

/** Tile-definition: walkability by TileId. Stage 4 adds full table; for now no override tiles. */
function isTileIdWalkable(_tileId: number): boolean {
	return false;
}
