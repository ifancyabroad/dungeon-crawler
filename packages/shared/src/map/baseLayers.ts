/**
 * Regenerate base map layers from seed + floor configs (deterministic).
 * Map-only responsibility; walkability is computed in walkableMask.ts.
 */

import { createRng } from "../rng";
import { buildDecorationLayer } from "./decorations";
import { generateMap } from "./generate";
import type { MapGenConfig } from "./types";
import { buildWaterMask } from "./water";
import type { FloorConfig } from "../game/types";
import { MAP_GEN_VERSION } from "../game/types";

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
