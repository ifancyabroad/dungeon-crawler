/**
 * API: request/response schemas and types used by the Express API and client.
 * Zod schemas for validation; types for responses (e.g. MongoDB-shaped).
 */

export type { HealthResponse } from "./health";
export type { ScoreInput, ScoreResponse } from "./score";
export { ScoreSchema } from "./score";
