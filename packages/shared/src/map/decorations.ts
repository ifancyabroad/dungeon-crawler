/**
 * Deterministic decoration layer: which cells have which decoration type (logical),
 * and which of those cells block movement. Server and client use this to get the same
 * blocking mask for walkability; client then maps types to tileset indices for rendering.
 */

import { createRng } from "../rng";
import { TILE_TYPE } from "./config";
import { wouldStayConnected } from "./connectivity";

/** Decoration types that block movement. Must match client tileset metadata (collision === true). */
export const BLOCKING_DECORATION_TYPES: ReadonlySet<string> = new Set(["rock"]);

/** All scatter-eligible decoration types (excluding path, which is placed from pathLayer). */
const SCATTER_DECORATION_TYPES: readonly DecorationType[] = ["grass", "plant", "bush", "rock"];

export type DecorationType = "path" | "grass" | "plant" | "bush" | "rock";

export interface BuildDecorationLayerResult {
	/** Same size as ground; true where water or a blocking decoration is. Use for isCellWalkable. */
	blockedMask: boolean[][];
	/** Same size as ground; '' or a decoration type. Client maps to tileset indices by theme. */
	decorationGrid: string[][];
}

/**
 * Build decoration layer (logical): path from pathLayer, weighted scatter for other types.
 * Blocking types are only placed when connectivity is preserved.
 * Deterministic for given seed and inputs; server and client get identical blockingMask.
 */
export function buildDecorationLayer(
	ground: number[][],
	wall: number[][],
	pathLayer: number[][],
	waterMask: boolean[][],
	spawn: { x: number; y: number },
	seed: number,
	weights: Record<string, number>,
	scatterChance: number,
): BuildDecorationLayerResult {
	const rng = createRng(seed + 1);
	const height = ground.length;
	const width = ground[0]?.length ?? 0;
	const blockedMask = waterMask.map((row) => [...row]);
	const decorationGrid: string[][] = Array.from({ length: height }, () => Array(width).fill(""));

	const decorationTypes = SCATTER_DECORATION_TYPES;
	const totalWeight = decorationTypes.reduce((sum, t) => sum + (weights[t] ?? 0), 0);

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (ground[y][x] !== TILE_TYPE.FLOOR || wall[y][x] === TILE_TYPE.WALL) continue;
			if (waterMask[y][x]) continue;
			if (x === spawn.x && y === spawn.y) continue;

			let type: string = "";
			if (pathLayer[y][x] === 1) {
				type = "path";
			} else if (rng() < scatterChance && totalWeight > 0) {
				let r = rng() * totalWeight;
				for (const t of decorationTypes) {
					const w = weights[t] ?? 0;
					if (w <= 0) continue;
					if (r < w) {
						type = t;
						break;
					}
					r -= w;
				}
			}

			if (!type) continue;

			if (BLOCKING_DECORATION_TYPES.has(type)) {
				if (!wouldStayConnected(ground, wall, blockedMask, spawn, x, y)) continue;
				blockedMask[y][x] = true;
			}
			decorationGrid[y][x] = type;
		}
	}
	return { blockedMask, decorationGrid };
}
