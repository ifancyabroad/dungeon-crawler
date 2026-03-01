/**
 * Shared package: deterministic game engine and schemas for API and client.
 * Import from "@app/shared".
 * Structure: api/ (HTTP contract types), map/ (dungeon generation), game/ (engine + snapshot schemas), rng/.
 */

export {
	buildDecorationLayer,
	buildGroundLayer,
	buildWallLayer,
	buildWaterMask,
	BLOCKING_DECORATION_TYPES,
	DEFAULT_MAP_HEIGHT,
	DEFAULT_MAP_WIDTH,
	TILE_TYPE,
	generateMap,
	isCellWalkable,
	wouldStayConnected,
	type BuildDecorationLayerResult,
	type GeneratedMap,
	type DecorationType,
	type MapGenAlgorithm,
	type MapGenConfig,
} from "./map";
export { createRng, createInitialRngState, createRngFromState, type Rng } from "./rng";

export {
	ActionSchema,
	MoveActionSchema,
	applyAction,
	buildGameStateFromPersisted,
	createInitialState,
	getWalkableForFloor,
	regenerateBaseMaps,
	FloorStateSchema,
	PersistedDynamicStateSchema,
	RngStateSchema,
	type Action,
	type ActionLogEntry,
	type ApplyActionResult,
	type BaseLayerFloor,
	type GameSessionDoc,
	type GameSnapshotDoc,
	type GameState,
	type MoveAction,
} from "./game";

export { createGameBodySchema, type CreateGameBody, type HealthResponse } from "./api";
