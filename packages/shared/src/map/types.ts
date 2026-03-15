/**
 * Map types. Constants and default config live in config.ts.
 */

import type { FloorTheme } from "./themes";

// ---------------------------------------------------------------------------
// Algorithm parameter bags
// ---------------------------------------------------------------------------

export interface BspParams {
	/** Room inset from BSP leaf bounds (1–3). */
	roomInset: number;
	/** Minimum room side length. */
	minRoomSize: number;
	/** Maximum room side length. Ignored if leaf is smaller. */
	maxRoomSize: number;
}

export interface CaveParams {
	/** Initial floor chance for cellular automata (0.35–0.55). */
	floorChance: number;
	/** Number of CA smoothing iterations. */
	caIterations: number;
	/** Neighbor floor count required to birth/survive a floor cell. */
	birthThreshold: number;
}

export interface HybridParams {
	/** CA floor chance for the outer cave shape (0.35–0.55). */
	caveFloorChance: number;
	/** Number of BSP rooms to stamp inside the carved cave. */
	roomCount: number;
	/** Room inset from each stamped room bounds. */
	roomInset: number;
}

export interface ArenaParams {
	/** Fraction of the half-map size for the arena radius (0.3–0.8). */
	arenaRadiusFraction: number;
}

export type MapGenAlgorithm = "bsp" | "cave" | "hybrid" | "arena";
export type AlgorithmParams = BspParams | CaveParams | HybridParams | ArenaParams;

// ---------------------------------------------------------------------------
// Encounter / spawn system
// ---------------------------------------------------------------------------

/** A single group of monsters in an encounter definition. */
export interface EncounterEntry {
	monsterId: string;
	count: number;
	weight: number;
}

/** An encounter definition: a named group that can be selected from a floor's encounter table. */
export interface EncounterDef {
	id: string;
	minDepth?: number;
	entries: EncounterEntry[];
}

/** Reference to an encounter in a floor's spawn table, with optional depth gates. */
export interface EncounterTableEntry {
	encounterId: string;
	weight: number;
	minDepth?: number;
	maxDepth?: number;
}

// ---------------------------------------------------------------------------
// Boss rules
// ---------------------------------------------------------------------------

/** Specifies how a boss is placed on a floor. */
export interface BossRules {
	monsterId: string;
	/** Room tag preference for boss placement. */
	preferredRoomTag: RoomTag;
}

// ---------------------------------------------------------------------------
// Room analysis
// ---------------------------------------------------------------------------

export type RoomTag =
	| "start"
	| "exit"
	| "boss"
	| "treasure"
	| "corridor"
	| "chamber"
	| "alcove"
	| "generic";

export interface AnalyzedRoom {
	id: number;
	/** Flat tile indices belonging to this room. */
	cells: number[];
	/** Flat tile index of the centroid cell. */
	center: number;
	area: number;
	tag: RoomTag;
	/** IDs of adjacent rooms (share a border cell). */
	connections: number[];
}

// ---------------------------------------------------------------------------
// Vault system
// ---------------------------------------------------------------------------

export interface VaultLegendEntry {
	tile: "wall" | "floor";
	marker?: string;
	/** Override the ground layer tile at this cell with a specific tileset index. */
	groundTileId?: number;
	/**
	 * Override the wall layer tile at this cell with a specific tileset index.
	 * When set, this cell is treated as a wall regardless of the `tile` field.
	 */
	wallTileId?: number;
	/** Stamp a specific tileset tile onto the decoration layer at this cell. */
	decorationTileId?: number;
	/** Whether this cell blocks movement. Drives the server-side walkability mask. */
	collision?: boolean;
}

export interface VaultSpawnEntry {
	marker: string;
	encounterId: string;
}

export interface VaultDef {
	id: string;
	width: number;
	height: number;
	/** Room tags this vault is eligible to stamp into. */
	tags: RoomTag[];
	minDepth?: number;
	/** ASCII layout rows. Each character must have an entry in legend. */
	layout: string[];
	legend: Record<string, VaultLegendEntry>;
	spawns?: VaultSpawnEntry[];
}

export interface VaultPlacement {
	vaultId: string;
	/** Flat tile index of the top-left origin cell of the stamp. */
	originIdx: number;
	/** Marker → flat tile index, for downstream encounter seeding. */
	markerCells: Record<string, number[]>;
	/** Flat tile index → tileset tile ID for ground layer overrides. */
	groundOverrides: Record<number, number>;
	/** Flat tile index → tileset tile ID for wall layer overrides. */
	wallOverrides: Record<number, number>;
	/** Flat tile index → tileset tile ID for decoration layer overrides. */
	decorationOverrides: Record<number, number>;
	/** Flat tile indices of cells that block movement. */
	collisionCells: number[];
}

// ---------------------------------------------------------------------------
// Floor configuration
// ---------------------------------------------------------------------------

/** Full floor configuration (no seed; seed = gameSeed + floorIndex at runtime). */
export interface FloorConfig {
	/** Visual theme for client tile mapping. */
	theme: FloorTheme;
	/** 1-based floor depth, used for difficulty scaling. */
	floorDepth: number;

	// Map shape
	width: number;
	height: number;
	/** Target fraction of map cells that are void (0–0.45). Higher = more irregular. */
	shapeVoidTarget: number;

	// Algorithm
	algorithm: MapGenAlgorithm;
	algorithmParams: AlgorithmParams;

	// Decoration
	decorationWeights: Record<string, number>;
	scatterChance: number;
	waterEnabled: boolean;

	// Encounters
	encounterTable: EncounterTableEntry[];
	/** Relative enemy density (0–1). Scales number of encounter groups placed. */
	enemyDensity: number;
	/** Reserved for future item placement (0–1). */
	itemDensity: number;

	// Special features
	/** IDs of eligible vaults to inject. */
	vaultIds: string[];
	/** Probability (0–1) that an eligible room is promoted to a special tag. */
	specialRoomFrequency: number;
	bossRules: BossRules | null;
}

// ---------------------------------------------------------------------------
// Raw map (output of algorithm stage, input to analysis/decoration stages)
// ---------------------------------------------------------------------------

/** Raw map as produced by an algorithm. Passed through subsequent pipeline stages. */
export interface RawMap {
	ground: number[][];
	wall: number[][];
	pathLayer: number[][];
	/** True where a cell is within the playable boundary. */
	shapeMask: boolean[][];
	/** Hero spawn cell. */
	spawn: { x: number; y: number };
}
