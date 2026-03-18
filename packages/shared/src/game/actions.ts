/**
 * Action schemas (Zod). Discriminated union on "type".
 * Move = cardinal movement. Attack = melee attack in a direction.
 * UseSkill = activate a hero skill, optionally with a targeting payload.
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

export const UseSkillActionSchema = z.object({
	type: z.literal("use_skill"),
	skillId: z.string(),
	/** Flat tile index for tile-targeted skills (e.g. fireball destination). */
	targetTileIdx: z.number().int().min(0).optional(),
	/** Actor id for actor-targeted skills (e.g. charge target). */
	targetActorId: z.string().optional(),
});

export type UseSkillAction = z.infer<typeof UseSkillActionSchema>;

/** Reserved for exhaustiveness; engine returns unknown_action. Not emitted by valid clients. */
const UnknownActionSchema = z.object({ type: z.literal("unknown") });

export const ActionSchema = z.discriminatedUnion("type", [
	MoveActionSchema,
	AttackActionSchema,
	UseSkillActionSchema,
	UnknownActionSchema,
]);

export type Action = z.infer<typeof ActionSchema>;
