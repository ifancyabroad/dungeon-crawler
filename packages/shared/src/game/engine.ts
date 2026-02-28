/**
 * Deterministic game engine: create initial state (with walkable grid) and apply actions.
 * Move validation uses stored walkable grid only; no map regeneration on move.
 */

import { createRng, type Rng } from "../rng";
import { buildDecorationLayer, buildWaterMask, generateMap, isCellWalkable } from "../map";
import type { MapGenConfig } from "../map/types";
import type { Action } from "./actions";
import type { GameState } from "./types";

const DEFAULT_DECORATION_WEIGHTS: Record<string, number> = {
	grass: 10,
	plant: 5,
	bush: 3,
	rock: 2,
};
const DEFAULT_SCATTER_CHANCE = 0.28;

/**
 * Build walkability grid from generated map layers (ground, wall, blockedMask).
 * One boolean per cell; walkable[y][x] === true means the cell can be walked on.
 */
function buildWalkableGrid(
	ground: number[][],
	wall: number[][],
	blockedMask: boolean[][],
): boolean[][] {
	const height = ground.length;
	const width = ground[0]?.length ?? 0;
	const walkable: boolean[][] = [];
	for (let y = 0; y < height; y++) {
		walkable[y] = [];
		for (let x = 0; x < width; x++) {
			walkable[y][x] = isCellWalkable(ground, wall, blockedMask, x, y);
		}
	}
	return walkable;
}

/**
 * Create initial game state: generate map once, derive walkable grid, set hero at spawn.
 */
export function createInitialState(seed: number, mapConfig: MapGenConfig): GameState {
	const rng = createRng(seed);
	const { ground, wall, spawn, pathLayer } = generateMap(mapConfig, rng);

	const waterMask = buildWaterMask(ground, wall, spawn, mapConfig.seed);
	const weights = mapConfig.decorationWeights ?? DEFAULT_DECORATION_WEIGHTS;
	const scatterChance = mapConfig.scatterChance ?? DEFAULT_SCATTER_CHANCE;
	const { blockedMask } = buildDecorationLayer(
		ground,
		wall,
		pathLayer,
		waterMask,
		spawn,
		mapConfig.seed,
		weights,
		scatterChance,
	);

	const walkable = buildWalkableGrid(ground, wall, blockedMask);

	return {
		turn: 0,
		hero: { x: spawn.x, y: spawn.y },
		seed,
		mapConfig,
		walkable,
	};
}

const DIRECTION_DELTA: Record<"up" | "down" | "left" | "right", { dx: number; dy: number }> = {
	up: { dx: 0, dy: -1 },
	down: { dx: 0, dy: 1 },
	left: { dx: -1, dy: 0 },
	right: { dx: 1, dy: 0 },
};

export type ApplyActionResult = { ok: true; state: GameState } | { ok: false; reason: string };

/**
 * Apply one action to state. Move uses stored walkable grid only; rng reserved for future use.
 */
export function applyAction(state: GameState, action: Action, _rng: Rng): ApplyActionResult {
	if (action.type === "move") {
		const { dx, dy } = DIRECTION_DELTA[action.direction];
		const nx = state.hero.x + dx;
		const ny = state.hero.y + dy;

		const height = state.walkable.length;
		const width = state.walkable[0]?.length ?? 0;
		if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
			return { ok: false, reason: "move_out_of_bounds" };
		}
		if (!state.walkable[ny][nx]) {
			return { ok: false, reason: "move_blocked" };
		}

		return {
			ok: true,
			state: {
				...state,
				turn: state.turn + 1,
				hero: { x: nx, y: ny },
			},
		};
	}

	return { ok: false, reason: "unknown_action" };
}
