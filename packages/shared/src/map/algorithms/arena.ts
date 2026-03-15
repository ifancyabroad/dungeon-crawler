/**
 * Arena map generation: a single large open chamber.
 * Produces a roughly oval/elliptical arena with a configurable radius fraction.
 * Suitable for boss encounters or large combat rooms.
 */

import type { Rng } from "../../rng";
import { TILE_TYPE } from "../config";
import type { FloorConfig, RawMap, ArenaParams } from "../types";
import { buildShapeMask } from "./shared";

export function generateArena(config: FloorConfig, rng: Rng): RawMap {
	const { width, height } = config;
	const params = config.algorithmParams as ArenaParams;
	const voidTarget = Math.max(0.05, Math.min(0.45, config.shapeVoidTarget));

	// Consume the shape mask RNG budget for determinism parity with other generators
	buildShapeMask(width, height, voidTarget, rng);

	const cx = (width - 1) / 2;
	const cy = (height - 1) / 2;
	const radiusFraction = Math.max(0.3, Math.min(0.8, params.arenaRadiusFraction));
	const rx = cx * radiusFraction;
	const ry = cy * radiusFraction;

	const ground: number[][] = Array.from({ length: height }, () =>
		Array(width).fill(TILE_TYPE.VOID),
	);
	const wall: number[][] = Array.from({ length: height }, () =>
		Array(width).fill(TILE_TYPE.WALL),
	);
	const pathLayer: number[][] = Array.from({ length: height }, () => Array(width).fill(0));
	const shapeMask: boolean[][] = Array.from({ length: height }, () => Array(width).fill(false));

	const floorSet = new Set<string>();

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const dx = x - cx;
			const dy = y - cy;
			const inside = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
			if (inside) {
				// Slight noise on the boundary for a natural look — consume RNG
				const noiseR = 1 + (rng() - 0.5) * 0.1;
				const noisy = (dx * dx) / (rx * rx * noiseR) + (dy * dy) / (ry * ry * noiseR) <= 1;
				if (noisy) {
					ground[y][x] = TILE_TYPE.FLOOR;
					wall[y][x] = TILE_TYPE.EMPTY;
					shapeMask[y][x] = true;
					floorSet.add(`${x},${y}`);
				} else {
					ground[y][x] = TILE_TYPE.FLOOR;
					wall[y][x] = TILE_TYPE.WALL;
					shapeMask[y][x] = true;
				}
			}
		}
	}

	// Ensure center is always floor
	const icx = Math.floor(cx);
	const icy = Math.floor(cy);
	ground[icy][icx] = TILE_TYPE.FLOOR;
	wall[icy][icx] = TILE_TYPE.EMPTY;
	floorSet.add(`${icx},${icy}`);

	const spawn = { x: icx, y: icy };
	return { ground, wall, spawn, pathLayer, shapeMask };
}
