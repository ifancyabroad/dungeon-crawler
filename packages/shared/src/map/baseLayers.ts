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
import { isCellWalkable } from "./walkability";

export interface BaseLayerFloor {
	ground: number[][];
	wall: number[][];
	blockedMask: boolean[][];
	width: number;
	height: number;
	/** Flat tile index of the hero spawn point for this floor. */
	spawnIdx: number;
	/** Flat tile index of the exit to the next floor. -1 if this is the last floor (no exit). */
	exitIdx: number;
}

/**
 * Find the walkable tile with maximum Euclidean distance from the spawn point.
 * Used to place the floor exit as far from the player as possible.
 * Returns -1 if no walkable tile found (should never happen on a valid map).
 */
export function findExitIdx(
	ground: number[][],
	wall: number[][],
	blockedMask: boolean[][],
	spawnIdx: number,
	width: number,
	height: number,
): number {
	const spawnX = spawnIdx % width;
	const spawnY = Math.floor(spawnIdx / width);
	let bestIdx = -1;
	let bestDist = -1;
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (!isCellWalkable(ground, wall, blockedMask, x, y)) continue;
			const dx = x - spawnX;
			const dy = y - spawnY;
			const dist = dx * dx + dy * dy;
			if (dist > bestDist) {
				bestDist = dist;
				bestIdx = y * width + x;
			}
		}
	}
	return bestIdx;
}

/**
 * Deterministic regeneration of base map layers per floor.
 * Uses mapGenVersion for future algorithm variants; floor seed = seed + floorIndex.
 * The last floor gets exitIdx = -1 (no exit).
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
	const lastFloorIndex = floorConfigs.length - 1;
	for (let i = 0; i < floorConfigs.length; i++) {
		const config: MapGenConfig = {
			...floorConfigs[i],
			seed: seed + i,
		};
		const rng = createRng(config.seed);
		const { ground, wall, spawn, pathLayer } = generateMap(config, rng);
		const waterMask = buildWaterMask(ground, wall, spawn, config.seed);
		const { blockedMask } = buildDecorationLayer(
			ground,
			wall,
			pathLayer,
			waterMask,
			spawn,
			config.seed,
			config.decorationWeights,
			config.scatterChance,
		);
		const width = config.width;
		const height = config.height;
		const spawnIdx = spawn.y * width + spawn.x;
		const exitIdx =
			i === lastFloorIndex
				? -1
				: findExitIdx(ground, wall, blockedMask, spawnIdx, width, height);
		result.push({ ground, wall, blockedMask, width, height, spawnIdx, exitIdx });
	}
	return result;
}
