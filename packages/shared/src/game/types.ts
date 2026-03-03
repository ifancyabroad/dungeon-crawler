/**
 * Game state types. JSON-serializable; no platform-specific imports.
 * No nested 2D arrays in persisted state; walkability computed at runtime when needed.
 */

import type { MapGenConfig } from "../map/types";
import type { Action } from "./actions";

export type TileId = number;

/** Per-floor map config (no seed; seed is run seed + floor index). Same shape as MapGenConfig minus seed. */
export type FloorConfig = Omit<MapGenConfig, "seed">;

/** Opaque id for an actor (hero or monster). Hero uses constant "hero". */
export type ActorId = string;

/** Full attribute names (no abbreviations). */
export interface ActorAttributes {
	strength: number;
	dexterity: number;
	constitution: number;
	intelligence: number;
	wisdom: number;
	charisma: number;
}

/** Per-skill state: optional level and cooldown. */
export interface ActorSkillState {
	level?: number;
	cooldownRemaining: number;
}

/** Definition reference: hero (classId from content) or monster. */
export type ActorDef = { type: "hero"; classId: string } | { type: "monster"; monsterId: string };

/** Actor: hero or monster. Use def.type for "hero" | "monster". Position is idx only; floor is implied by which floor's actorsById contains it. */
export interface Actor {
	id: string;
	name: string;
	idx: number;
	alive: boolean;
	hp: number;
	maxHp: number;
	attributes: ActorAttributes;
	skills: Record<string, ActorSkillState>;
	def: ActorDef;
}

export interface FloorState {
	tileOverrides: Record<string, TileId>;
	actorsById: Record<ActorId, Actor>;
}

/** Single floor: config + dynamic state. No parallel arrays. */
export interface Floor {
	config: FloorConfig;
	state: FloorState;
}

/** Concrete RNG state: serializable, Zod-validatable. Engine advances it in applyAction. */
export type RngState =
	| { algo: "xorshift32"; s: number }
	| { algo: "sfc32"; a: number; b: number; c: number; d: number };

export const MAP_GEN_VERSION = 1;

/** In-memory game state. No walkableByFloor; engine computes walkability when needed. */
export interface GameState {
	turn: number;
	heroId: ActorId;
	heroFloorIndex: number;
	seed: number;
	mapGenVersion: number;
	floors: Floor[];
	rngState: RngState;
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
	heroId: ActorId;
	heroFloorIndex: number;
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
