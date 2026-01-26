import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Score
// ─────────────────────────────────────────────────────────────────────────────

/** Schema for validating score creation input */
export const ScoreSchema = z.object({
	player: z.string(),
	points: z.number().int().nonnegative(),
});

/** Input type for creating a score */
export type ScoreInput = z.infer<typeof ScoreSchema>;

/** API response type for a score (includes MongoDB fields) */
export interface ScoreResponse {
	_id: string;
	player: string;
	points: number;
	createdAt: string;
	updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Health
// ─────────────────────────────────────────────────────────────────────────────

/** API response type for health check */
export interface HealthResponse {
	ok: boolean;
}
