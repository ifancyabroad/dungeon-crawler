import { z } from "zod";

/**
 * Request body for POST /api/game.
 * Optional seed for debug/replay; when omitted the server generates a random seed.
 */
export const createGameBodySchema = z
	.object({ seed: z.number().int().positive().optional() })
	.strict();

export type CreateGameBody = z.infer<typeof createGameBodySchema>;
