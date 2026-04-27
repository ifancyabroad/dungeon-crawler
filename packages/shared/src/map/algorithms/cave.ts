/**
 * Cave generation: cellular automata for organic, cavern-like layouts.
 * Configurable CA iterations and birth threshold via CaveParams.
 */

import type { Rng } from "../../rng";
import { TILE_TYPE } from "../../config/map";
import type { FloorConfig, RawMap, CaveParams } from "../types";
import { buildShapeMask, floodFillFloor, countFloorNeighbors, closestCell } from "./shared";

export function generateCave(config: FloorConfig, rng: Rng): RawMap {
	const { width, height } = config;
	const params = config.algorithmParams as CaveParams;
	const voidTarget = Math.max(0.05, Math.min(0.45, config.shapeVoidTarget));
	const mask = buildShapeMask(width, height, voidTarget, rng);
	const cx = Math.floor(width / 2);
	const cy = Math.floor(height / 2);

	const ground: number[][] = Array.from({ length: height }, () =>
		Array(width).fill(TILE_TYPE.FLOOR),
	);
	const wall: number[][] = Array.from({ length: height }, () =>
		Array(width).fill(TILE_TYPE.WALL),
	);
	const pathLayer: number[][] = Array.from({ length: height }, () => Array(width).fill(0));

	// Mark void outside mask
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (!mask[y][x]) ground[y][x] = TILE_TYPE.VOID;
		}
	}

	const floorChance = Math.max(0.35, Math.min(0.55, params.floorChance));
	const caIter = Math.max(1, Math.min(10, params.caIterations));
	const birthThr = Math.max(1, Math.min(7, params.birthThreshold));

	// Random fill
	for (let y = 1; y < height - 1; y++) {
		for (let x = 1; x < width - 1; x++) {
			if (!mask[y][x]) continue;
			ground[y][x] = rng() < floorChance ? TILE_TYPE.FLOOR : TILE_TYPE.WALL;
		}
	}

	// CA smoothing
	for (let iter = 0; iter < caIter; iter++) {
		const next = ground.map((row) => [...row]);
		for (let y = 1; y < height - 1; y++) {
			for (let x = 1; x < width - 1; x++) {
				if (!mask[y][x]) continue;
				const n = countFloorNeighbors(ground, x, y, width, height, TILE_TYPE.FLOOR);
				next[y][x] =
					n >= birthThr || (ground[y][x] === TILE_TYPE.FLOOR && n >= birthThr - 1)
						? TILE_TYPE.FLOOR
						: TILE_TYPE.WALL;
			}
		}
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				ground[y][x] = next[y][x];
			}
		}
	}

	// Enforce borders and shape boundary
	for (let x = 0; x < width; x++) {
		ground[0][x] = !mask[0][x] ? TILE_TYPE.VOID : TILE_TYPE.WALL;
		ground[height - 1][x] = !mask[height - 1][x] ? TILE_TYPE.VOID : TILE_TYPE.WALL;
	}
	for (let y = 0; y < height; y++) {
		ground[y][0] = !mask[y][0] ? TILE_TYPE.VOID : TILE_TYPE.WALL;
		ground[y][width - 1] = !mask[y][width - 1] ? TILE_TYPE.VOID : TILE_TYPE.WALL;
	}
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (!mask[y][x]) ground[y][x] = TILE_TYPE.VOID;
		}
	}

	// Keep only connected component from center
	if (mask[cy][cx] && ground[cy][cx] !== TILE_TYPE.FLOOR) ground[cy][cx] = TILE_TYPE.FLOOR;
	const component = floodFillFloor(ground, cx, cy, width, height, TILE_TYPE.FLOOR);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (!component.has(`${x},${y}`)) {
				ground[y][x] = !mask[y][x] ? TILE_TYPE.VOID : TILE_TYPE.WALL;
			}
		}
	}

	// Wall layer: EMPTY where component, WALL elsewhere
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			wall[y][x] = component.has(`${x},${y}`) ? TILE_TYPE.EMPTY : TILE_TYPE.WALL;
		}
	}
	// Normalize ground — everything in component is FLOOR
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (ground[y][x] !== TILE_TYPE.VOID) ground[y][x] = TILE_TYPE.FLOOR;
		}
	}

	const spawn = closestCell(component, cx, cy);
	return { ground, wall, spawn, pathLayer, shapeMask: mask, bspRooms: [] };
}
