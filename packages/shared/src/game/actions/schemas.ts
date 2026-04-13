/**
 * Action schemas (Zod). Discriminated union on "type".
 * Move = cardinal movement. Attack = melee attack in a direction.
 * UseSkill = activate a hero skill, optionally with a targeting payload.
 * SelectSkillChoice = pick a skill from a level-up offer (resolves pendingInteraction).
 * RerollSkillChoice = re-sample the level-up offer set.
 * PickupItem = equip a specific item instance from a loot pile (resolves loot_pickup interaction).
 * LeaveLoot = discard remaining loot and clear the pile (resolves loot_pickup interaction).
 */

import { z } from "zod";

const DIRECTION = [
	"up",
	"down",
	"left",
	"right",
	"up-left",
	"up-right",
	"down-left",
	"down-right",
] as const;

export type Direction = (typeof DIRECTION)[number];

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

export const PickupItemActionSchema = z.object({
	type: z.literal("pickup_item"),
	/** Flat tile index of the loot pile. Must match pendingInteraction.tileIdx. */
	tileIdx: z.number().int().min(0),
	/** instanceId of the item to equip from the pile. */
	instanceId: z.string(),
});

export type PickupItemAction = z.infer<typeof PickupItemActionSchema>;

export const LeaveLootActionSchema = z.object({
	type: z.literal("leave_loot"),
	/** Flat tile index of the loot pile. Must match pendingInteraction.tileIdx. */
	tileIdx: z.number().int().min(0),
});

export type LeaveLootAction = z.infer<typeof LeaveLootActionSchema>;

export const WaitActionSchema = z.object({
	type: z.literal("wait"),
});

export type WaitAction = z.infer<typeof WaitActionSchema>;

/** Reserved for exhaustiveness; engine returns unknown_action. Not emitted by valid clients. */
const UnknownActionSchema = z.object({ type: z.literal("unknown") });

export const ActionSchema = z.discriminatedUnion("type", [
	MoveActionSchema,
	AttackActionSchema,
	UseSkillActionSchema,
	SelectSkillChoiceActionSchema,
	RerollSkillChoiceActionSchema,
	PickupItemActionSchema,
	LeaveLootActionSchema,
	WaitActionSchema,
	UnknownActionSchema,
]);

export type Action = z.infer<typeof ActionSchema>;
