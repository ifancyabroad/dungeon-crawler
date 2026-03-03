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

/** Reserved for exhaustiveness; engine returns unknown_action. Not emitted by valid clients. */
const UnknownActionSchema = z.object({ type: z.literal("unknown") });

export const ActionSchema = z.discriminatedUnion("type", [MoveActionSchema, UnknownActionSchema]);

export type Action = z.infer<typeof ActionSchema>;
