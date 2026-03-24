/**
 * Map domain: deterministic dungeon generation and map utilities.
 * Tunables (`TILE_TYPE`, `FLOOR_CONFIGS`, etc.) live in `config/map.ts` and are exported from `@app/shared` via `./config`.
 */

export type {
	AlgorithmParams,
	AnalyzedRoom,
	ArenaParams,
	BossRules,
	BspParams,
	CaveParams,
	EncounterDef,
	EncounterEntry,
	EncounterTableEntry,
	FloorConfig,
	HybridParams,
	MapGenAlgorithm,
	RawMap,
	RoomTag,
	VaultDef,
	VaultLegendEntry,
	VaultPlacement,
	VaultSpawnEntry,
} from "./types";
export type { FloorTheme } from "./types";
export { buildGroundLayer, buildWallLayer } from "./build";
export { generateMap } from "./generate";
export { wouldStayConnected } from "./connectivity";
export { buildWaterMask } from "./water";
export { buildDecorationLayer, BLOCKING_DECORATION_TYPES } from "./decorations";
export type { BuildDecorationLayerResult, DecorationType } from "./decorations";
export { isCellWalkable } from "./walkability";
export { computeWalkableMaskForFloor } from "./walkableMask";
export {
	regenerateBaseMaps,
	findExitIdx,
	type BaseLayerFloor,
	type RegenerateOptions,
} from "./baseLayers";
export { computeOpacityMask, computeVisibility, mergeExplored } from "./visibility";
export { bfsNextStep } from "./pathfinding";
export { analyzeRooms } from "./roomAnalysis";
export { injectVaults } from "./vaultInjector";
