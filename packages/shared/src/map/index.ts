/**
 * Map: deterministic dungeon/map generation.
 * Re-exports public API for this domain.
 */

export {
	DEFAULT_BSP_PARAMS,
	DEFAULT_BSP_ROOM_INSET,
	DEFAULT_CAVE_FLOOR_CHANCE,
	DEFAULT_CAVE_PARAMS,
	DEFAULT_DECORATION_WEIGHTS,
	DEFAULT_FLOOR_CONFIG,
	DEFAULT_FLOOR_THEME,
	DEFAULT_MAP_ALGORITHM,
	DEFAULT_MAP_HEIGHT,
	DEFAULT_MAP_WIDTH,
	DEFAULT_SCATTER_CHANCE,
	TILE_TYPE,
} from "./config";
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
export { FLOOR_THEMES } from "./themes";
export type { FloorTheme } from "./themes";
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
export { FLOOR_CONFIGS } from "./floorConfigs";
export { computeOpacityMask, computeVisibility, mergeExplored } from "./visibility";
export { bfsNextStep } from "./pathfinding";
export { analyzeRooms } from "./roomAnalysis";
export { injectVaults, BLOCKING_VAULT_TILE_IDS } from "./vaultInjector";
