/**
 * Deterministic game engine: create initial state and apply actions.
 * Walkability derived from base map + overrides (no walkable grid persisted).
 * RNG state is part of state and updated by applyAction for replay.
 */

import type { Action } from "./actions";
import type { FloorConfig, GameState, HeroState, RngState } from "./types";
import { MAP_GEN_VERSION } from "./types";
import { regenerateBaseMaps, getWalkableForFloor } from "./reconstruct";

function createInitialRngState(seed: number): RngState {
	return { algo: "xorshift32", s: seed >>> 0 || 1 };
}

function createRngFromState(initial: RngState): { rng: () => number; getState: () => RngState } {
	if (initial.algo !== "xorshift32") {
		throw new Error(`Unsupported RngState algo: ${(initial as { algo: string }).algo}`);
	}
	let s = initial.s >>> 0;
	return {
		rng: function next(): number {
			s ^= s << 13;
			s ^= s >>> 17;
			s ^= s << 5;
			s = s >>> 0;
			return s / 4294967296;
		},
		getState: (): RngState => ({ algo: "xorshift32", s }),
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
 * Create initial game state: one floor, hero at spawn, rngState from seed.
 * Uses regenerateBaseMaps for deterministic base layers; walkableByFloor derived (not persisted).
 */
export function createInitialState(seed: number, floorConfig: FloorConfig): GameState {
	const rngState = createInitialRngState(seed);
	const floorConfigs: FloorConfig[] = [floorConfig];
	const baseLayers = regenerateBaseMaps(seed, floorConfigs, MAP_GEN_VERSION);
	const floor0 = baseLayers[0];
	const walkable0 = getWalkableForFloor(floor0, {});
	const floorState = {
		tileOverrides: {} as Record<number, number>,
		entities: {} as Record<string, import("./types").Entity>,
		items: {} as Record<string, import("./types").Item>,
	};
	return {
		turn: 0,
		hero: { floorIndex: 0, x: floor0.spawn.x, y: floor0.spawn.y },
		seed,
		mapGenVersion: MAP_GEN_VERSION,
		floors: [{ config: floorConfig, state: floorState }],
		rngState,
		walkableByFloor: [walkable0],
	};
}

/**
 * Apply one action to state. Move uses walkableByFloor (derived at load).
 * Advances state.rngState deterministically; returned state includes updated rngState.
 */
export function applyAction(state: GameState, action: Action, _rng?: unknown): ApplyActionResult {
	const { rng: rngFn, getState } = createRngFromState(state.rngState);
	// Advance RNG at least once per turn so replay is deterministic regardless of draws used
	rngFn();

	if (action.type === "move") {
		const fi = state.hero.floorIndex;
		const walkable = state.walkableByFloor?.[fi];
		if (!walkable) {
			return { ok: false, reason: "move_no_walkable" };
		}
		const height = walkable.length;
		const width = walkable[0]?.length ?? 0;
		const { dx, dy } = DIRECTION_DELTA[action.direction];
		const nx = state.hero.x + dx;
		const ny = state.hero.y + dy;
		if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
			return { ok: false, reason: "move_out_of_bounds" };
		}
		if (!walkable[ny][nx]) {
			return { ok: false, reason: "move_blocked" };
		}
		const newHero: HeroState = { ...state.hero, x: nx, y: ny };
		return {
			ok: true,
			state: {
				...state,
				turn: state.turn + 1,
				hero: newHero,
				rngState: getState(),
			},
		};
	}
	return { ok: false, reason: "unknown_action" };
}

/**
 * Helper: build full GameState from persisted dynamic state + session metadata.
 * Caller provides floorConfigs and replayed state (turn, hero, floors, rngState); this adds
 * walkableByFloor from regenerateBaseMaps + getWalkableForFloor.
 */
export function buildGameStateFromPersisted(
	seed: number,
	mapGenVersion: number,
	floorConfigs: FloorConfig[],
	persisted: {
		turn: number;
		hero: HeroState;
		floors: import("./types").FloorState[];
		rngState: import("./types").RngState;
	},
): GameState {
	const baseLayers = regenerateBaseMaps(seed, floorConfigs, mapGenVersion);
	const walkableByFloor = baseLayers.map((base, i) =>
		getWalkableForFloor(base, persisted.floors[i]?.tileOverrides ?? {}),
	);
	const floors = floorConfigs.map((config, i) => ({
		config,
		state: persisted.floors[i] ?? {
			tileOverrides: {},
			entities: {},
			items: {},
		},
	}));
	return {
		turn: persisted.turn,
		hero: persisted.hero,
		seed,
		mapGenVersion,
		floors,
		rngState: persisted.rngState,
		walkableByFloor,
	};
}
