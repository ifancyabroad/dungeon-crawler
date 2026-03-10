/**
 * Map: deterministic dungeon/map generation.
 * Re-exports public API for this domain.
 */

export {
	DEFAULT_BSP_ROOM_INSET,
	DEFAULT_CAVE_FLOOR_CHANCE,
	DEFAULT_DECORATION_WEIGHTS,
	DEFAULT_FLOOR_CONFIG,
	DEFAULT_FLOOR_THEME,
	DEFAULT_MAP_ALGORITHM,
	DEFAULT_MAP_HEIGHT,
	DEFAULT_MAP_WIDTH,
	DEFAULT_SCATTER_CHANCE,
	TILE_TYPE,
} from "./config";
export type { GeneratedMap, MapGenAlgorithm, MapGenConfig } from "./types";
export { buildGroundLayer, buildWallLayer } from "./build";
export { generateMap } from "./generate";
export { wouldStayConnected } from "./connectivity";
export { buildWaterMask } from "./water";
export { buildDecorationLayer, BLOCKING_DECORATION_TYPES } from "./decorations";
export type { BuildDecorationLayerResult, DecorationType } from "./decorations";
export { isCellWalkable } from "./walkability";
export { computeWalkableMaskForFloor } from "./walkableMask";
export { regenerateBaseMaps, type BaseLayerFloor } from "./baseLayers";
export { computeOpacityMask, computeVisibility, mergeExplored } from "./visibility";
