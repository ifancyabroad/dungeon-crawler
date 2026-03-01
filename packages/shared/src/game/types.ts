/**
 * Game state types. JSON-serializable; no platform-specific imports.
 * No nested 2D arrays in persisted state; walkability derived at load time.
 */

import type { MapGenAlgorithm } from "../map/types";
import type { Action } from "./actions";

export type TileId = number;

export interface FloorConfig {
	width: number;
	height: number;
	theme: string;
	algorithm?: MapGenAlgorithm;
	caveFloorChance?: number;
	bspRoomInset?: number;
	decorationWeights?: Record<string, number>;
	scatterChance?: number;
	/** Optional; regenerateBaseMaps uses run seed + floor index when not set. */
	seed?: number;
}

export interface Entity {
	id: string;
	kind: string;
	x: number;
	y: number;
	data?: Record<string, unknown>;
}

export interface Item {
	id: string;
	kind: string;
	x: number;
	y: number;
	data?: Record<string, unknown>;
}

export interface FloorState {
	tileOverrides: Record<number, TileId>;
	entities: Record<string, Entity>;
	items: Record<string, Item>;
}

/** Single floor: config + dynamic state. No parallel arrays. */
export interface Floor {
	config: FloorConfig;
	state: FloorState;
}

export interface HeroState {
	floorIndex: number;
	x: number;
	y: number;
}

/** Concrete RNG state: serializable, Zod-validatable. Engine advances it in applyAction. */
export type RngState =
	| { algo: "xorshift32"; s: number }
	| { algo: "sfc32"; a: number; b: number; c: number; d: number };

export const MAP_GEN_VERSION = 1;

/** In-memory game state. walkableByFloor is derived at load, not persisted. */
export interface GameState {
	turn: number;
	hero: HeroState;
	seed: number;
	mapGenVersion: number;
	floors: Floor[];
	rngState: RngState;
	/** Derived at load from base map + overrides; not persisted. */
	walkableByFloor?: boolean[][][];
}

// --- Persisted (no 2D arrays) ---

/** One document per game: metadata only. Configs only; no state. */
export interface GameSessionDoc {
	gameId: string;
	tokenHash: string;
	lastSeenAt: Date;
	userId: unknown | null;
	seed: number;
	mapGenVersion: number;
	floorConfigs: FloorConfig[];
	latestSnapshotTurn: number;
}

/** Dynamic state only. Snapshot stores floors[].state; session has floorConfigs; reconstruct zips by index. */
export interface PersistedDynamicState {
	turn: number;
	hero: HeroState;
	floors: FloorState[];
	rngState: RngState;
}

/** Action log: turn = state.turn BEFORE applying this action (expectedTurn). Unique (gameId, turn). */
export interface ActionLogEntry {
	gameId: string;
	/** Turn before apply; after apply state.turn === turn + 1. */
	turn: number;
	action: Action;
	stateHash?: string;
}

export interface GameSnapshotDoc {
	gameId: string;
	turn: number;
	state: PersistedDynamicState;
	createdAt: Date;
}
