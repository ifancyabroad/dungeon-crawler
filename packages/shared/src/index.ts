/**
 * Shared package: deterministic game engine and schemas for API and client.
 * Import from "@app/shared". Structure: map/ (dungeon generation), api/ (request/response schemas).
 */

export {
	buildGroundLayer,
	buildWallLayer,
	DEFAULT_MAP_HEIGHT,
	DEFAULT_MAP_WIDTH,
	TILE_TYPE,
} from "./map";

export type { HealthResponse } from "./api";
export type { ScoreInput, ScoreResponse } from "./api";
export { ScoreSchema } from "./api";
