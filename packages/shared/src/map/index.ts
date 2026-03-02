/**
 * Map: deterministic dungeon/map generation.
 * Re-exports public API for this domain.
 */

export {
	DEFAULT_DECORATION_WEIGHTS,
	DEFAULT_MAP_HEIGHT,
	DEFAULT_MAP_WIDTH,
	TILE_TYPE,
	type GeneratedMap,
	type MapGenAlgorithm,
	type MapGenConfig,
} from "./types";
export { buildGroundLayer, buildWallLayer } from "./build";
export { generateMap } from "./generate";
export { wouldStayConnected } from "./connectivity";
export { buildWaterMask } from "./water";
export { buildDecorationLayer, BLOCKING_DECORATION_TYPES } from "./decorations";
export type { BuildDecorationLayerResult, DecorationType } from "./decorations";
export { isCellWalkable } from "./walkability";
export { computeWalkableMaskForFloor } from "./walkableMask";
export { regenerateBaseMaps, type BaseLayerFloor } from "./baseLayers";
