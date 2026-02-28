/**
 * Action schemas (Zod). Cardinal move only at boundary.
 */

import { z } from "zod";

const DIRECTION = ["up", "down", "left", "right"] as const;

export const MoveActionSchema = z.object({
	type: z.literal("move"),
	direction: z.enum(DIRECTION),
});

export type MoveAction = z.infer<typeof MoveActionSchema>;

export const ActionSchema = z.discriminatedUnion("type", [MoveActionSchema]);

export type Action = z.infer<typeof ActionSchema>;
