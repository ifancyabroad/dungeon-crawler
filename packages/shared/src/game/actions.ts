/**
 * Action schemas (Zod). Discriminated union on "type".
 * Move = cardinal movement. Attack = melee attack in a direction.
 */

import { z } from "zod";

const DIRECTION = ["up", "down", "left", "right"] as const;

export const MoveActionSchema = z.object({
	type: z.literal("move"),
	direction: z.enum(DIRECTION),
});

export type MoveAction = z.infer<typeof MoveActionSchema>;

export const AttackActionSchema = z.object({
	type: z.literal("attack"),
	direction: z.enum(DIRECTION),
});

export type AttackAction = z.infer<typeof AttackActionSchema>;

/** Reserved for exhaustiveness; engine returns unknown_action. Not emitted by valid clients. */
const UnknownActionSchema = z.object({ type: z.literal("unknown") });

export const ActionSchema = z.discriminatedUnion("type", [
	MoveActionSchema,
	AttackActionSchema,
	UnknownActionSchema,
]);

export type Action = z.infer<typeof ActionSchema>;
