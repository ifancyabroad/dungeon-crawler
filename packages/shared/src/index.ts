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
	DEFAULT_DECORATION_WEIGHTS,
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
	actorKind,
	applyAction,
	buildGameStateFromPersisted,
	createInitialState,
	getHero,
	computeWalkableMaskForFloor,
	idxToXY,
	regenerateBaseMaps,
	xyToIdx,
	MAP_GEN_VERSION,
	ActorAttributesSchema,
	ActorDefSchema,
	ActorsByIdSchema,
	ActorSchema,
	ActorSkillStateSchema,
	FloorStateSchema,
	PersistedDynamicStateSchema,
	RngStateSchema,
	type Action,
	type ActionLogEntry,
	type Actor,
	type ActorAttributes,
	type ActorDef,
	type ActorId,
	type ActorSkillState,
	type ApplyActionContext,
	type ApplyActionResult,
	type BaseLayerFloor,
	type GameSessionDoc,
	type GameSnapshotDoc,
	type GameState,
	type MoveAction,
} from "./game";

export { createGameBodySchema, type CreateGameBody, type HealthResponse } from "./api";
