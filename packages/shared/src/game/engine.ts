/**
 * Deterministic game engine: create initial state and apply actions.
 * Walkability: pass via context.getWalkableMask (caller can cache); otherwise computed from state (no cache).
 * RNG state is only advanced when an action actually uses RNG (e.g. future spawns/combat).
 */

import type { Action } from "./actions";
import type { Actor, FloorConfig, GameState } from "./types";
import type { PersistedDynamicState } from "./types";
import { MAP_GEN_VERSION } from "./types";
import { createInitialRngState } from "../rng";
import { computeWalkableMaskForFloor, regenerateBaseMaps } from "../map";

/** Optional context: idx-based walkability mask per floor. mask[idx] === 1 means walkable. */
export interface ApplyActionContext {
	getWalkableMask(floorIndex: number): Uint8Array;
}

const DIRECTION_DELTA: Record<"up" | "down" | "left" | "right", { dx: number; dy: number }> = {
	up: { dx: 0, dy: -1 },
	down: { dx: 0, dy: 1 },
	left: { dx: -1, dy: 0 },
	right: { dx: 1, dy: 0 },
};

export type ApplyActionResult = { ok: true; state: GameState } | { ok: false; reason: string };

/** Convert linear index to x,y. idx = y * width + x. */
export function idxToXY(idx: number, width: number): { x: number; y: number } {
	const x = idx % width;
	const y = Math.floor(idx / width);
	return { x, y };
}

/** Convert x,y to linear index. idx = y * width + x. */
export function xyToIdx(x: number, y: number, width: number): number {
	return y * width + x;
}

/** Get the hero actor from state. Hero floor is state.heroFloorIndex; hero id is state.heroId. */
export function getHero(state: GameState): Actor | undefined {
	return state.floors[state.heroFloorIndex]?.state.actorsById[state.heroId];
}

/** Actor "kind" is def.type. Use this instead of a removed .kind field. */
export function actorKind(a: Actor): "hero" | "monster" {
	return a.def.type;
}

const DEFAULT_ATTRIBUTES = {
	strength: 10,
	dexterity: 10,
	constitution: 10,
	intelligence: 10,
	wisdom: 10,
	charisma: 10,
} as const;

/**
 * Create initial game state: one floor, hero actor at spawn, rngState from seed.
 * No walkableByFloor on state; engine computes when needed.
 */
export function createInitialState(seed: number, floorConfig: FloorConfig): GameState {
	const rngState = createInitialRngState(seed);
	const floorConfigs: FloorConfig[] = [floorConfig];
	const baseLayers = regenerateBaseMaps(seed, floorConfigs, MAP_GEN_VERSION);
	const floor0 = baseLayers[0];
	const width = floorConfig.width;
	const spawnIdx = xyToIdx(floor0.spawn.x, floor0.spawn.y, width);

	const heroActor: Actor = {
		id: "hero",
		name: "Hero",
		idx: spawnIdx,
		alive: true,
		hp: 100,
		maxHp: 100,
		attributes: { ...DEFAULT_ATTRIBUTES },
		skills: {},
		def: { type: "hero", classId: "warrior" },
	};

	const floorState = {
		tileOverrides: {} as Record<number, number>,
		actorsById: { hero: heroActor } as Record<import("./types").ActorId, Actor>,
	};

	return {
		turn: 0,
		heroId: "hero",
		heroFloorIndex: 0,
		seed,
		mapGenVersion: MAP_GEN_VERSION,
		floors: [{ config: floorConfig, state: floorState }],
		rngState,
	};
}

/**
 * Apply one action to state. Move uses context.getWalkableMask if provided (idx-based mask),
 * otherwise computes from state (regenerateBaseMaps + computeWalkableMaskForFloor).
 * RNG is only advanced when an action uses it (move does not).
 */
export function applyAction(
	state: GameState,
	action: Action,
	context?: ApplyActionContext,
): ApplyActionResult {
	if (action.type === "move") {
		const hero = getHero(state);
		if (!hero) {
			return { ok: false, reason: "move_no_hero" };
		}
		const fi = state.heroFloorIndex;
		const floor = state.floors[fi];
		if (!floor) {
			return { ok: false, reason: "move_no_floor" };
		}
		const width = floor.config.width;
		const height = floor.config.height;
		const size = width * height;

		let mask: Uint8Array;
		if (context?.getWalkableMask) {
			mask = context.getWalkableMask(fi);
		} else {
			const baseLayers = regenerateBaseMaps(
				state.seed,
				state.floors.map((f) => f.config),
				state.mapGenVersion,
			);
			const base = baseLayers[fi];
			if (!base) {
				return { ok: false, reason: "move_no_walkable" };
			}
			mask = computeWalkableMaskForFloor(base, floor.state.tileOverrides ?? {});
		}

		const { x, y } = idxToXY(hero.idx, width);
		const { dx, dy } = DIRECTION_DELTA[action.direction];
		const nx = x + dx;
		const ny = y + dy;
		if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
			return { ok: false, reason: "move_out_of_bounds" };
		}
		const newIdx = xyToIdx(nx, ny, width);
		if (newIdx < 0 || newIdx >= size || mask[newIdx] !== 1) {
			return { ok: false, reason: "move_blocked" };
		}
		const updatedHero: Actor = { ...hero, idx: newIdx };
		const newActorsById = { ...floor.state.actorsById, [state.heroId]: updatedHero };
		const newFloorState = { ...floor.state, actorsById: newActorsById };
		const newFloors = state.floors.slice();
		newFloors[fi] = { ...floor, state: newFloorState };

		return {
			ok: true,
			state: {
				...state,
				turn: state.turn + 1,
				floors: newFloors,
				rngState: state.rngState,
			},
		};
	}
	return { ok: false, reason: "unknown_action" };
}

/**
 * Build full GameState from persisted dynamic state + session metadata.
 * No walkableByFloor on returned state.
 */
export function buildGameStateFromPersisted(
	seed: number,
	mapGenVersion: number,
	floorConfigs: FloorConfig[],
	persisted: {
		turn: number;
		heroId: import("./types").ActorId;
		heroFloorIndex: number;
		floors: import("./types").FloorState[];
		rngState: import("./types").RngState;
	},
): GameState {
	const defaultFloorState: import("./types").FloorState = {
		tileOverrides: {},
		actorsById: {},
	};
	const floors = floorConfigs.map((config, i) => ({
		config,
		state: persisted.floors[i] ?? defaultFloorState,
	}));
	return {
		turn: persisted.turn,
		heroId: persisted.heroId,
		heroFloorIndex: persisted.heroFloorIndex,
		seed,
		mapGenVersion,
		floors,
		rngState: persisted.rngState,
	};
}

/** Convert full GameState to persisted dynamic state (for snapshots). Single source of truth for the shape. */
export function gameStateToPersisted(state: GameState): PersistedDynamicState {
	return {
		turn: state.turn,
		heroId: state.heroId,
		heroFloorIndex: state.heroFloorIndex,
		floors: state.floors.map((f) => f.state),
		rngState: state.rngState,
	};
}
