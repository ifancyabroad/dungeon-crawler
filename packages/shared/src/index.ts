import { z } from "zod";
export const ScoreSchema = z.object({
	player: z.string(),
	points: z.number().int().nonnegative(),
});
export type Score = z.infer<typeof ScoreSchema>;
