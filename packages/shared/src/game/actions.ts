/**
 * Action schemas (Zod). Discriminated union on "type".
 * Move = cardinal movement. Attack = melee attack in a direction.
 * UseSkill = activate a hero skill, optionally with a targeting payload.
 * SelectSkillChoice = pick a skill from a level-up offer (resolves pendingInteraction).
 * RerollSkillChoice = re-sample the level-up offer set.
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

export const SelectSkillChoiceActionSchema = z.object({
	type: z.literal("select_skill_choice"),
	/** The skill id the player has chosen from the current offer set. */
	skillId: z.string(),
});

export type SelectSkillChoiceAction = z.infer<typeof SelectSkillChoiceActionSchema>;

export const RerollSkillChoiceActionSchema = z.object({
	type: z.literal("reroll_skill_choice"),
});

export type RerollSkillChoiceAction = z.infer<typeof RerollSkillChoiceActionSchema>;

/** Reserved for exhaustiveness; engine returns unknown_action. Not emitted by valid clients. */
const UnknownActionSchema = z.object({ type: z.literal("unknown") });

export const ActionSchema = z.discriminatedUnion("type", [
	MoveActionSchema,
	AttackActionSchema,
	UseSkillActionSchema,
	SelectSkillChoiceActionSchema,
	RerollSkillChoiceActionSchema,
	UnknownActionSchema,
]);

export type Action = z.infer<typeof ActionSchema>;
