import { z } from "zod";

/**
 * Request body for POST /api/game.
 * classId + heroName are required for character creation.
 * Optional seed for debug/replay; when omitted the server generates a random seed.
 */
export const createGameBodySchema = z
	.object({
		seed: z.number().int().positive().optional(),
		classId: z.string().min(1),
		heroName: z.string().min(3).max(10),
	})
	.strict();

export type CreateGameBody = z.infer<typeof createGameBodySchema>;
