/**
 * Zod schema and types for monster definitions.
 */

import { z } from "zod";
import {
	AbilityNameSchema,
	ActorAttributesSchema as BaseAttributesSchema,
	DAMAGE_TYPES,
} from "@app/shared";

type DamageType = (typeof DAMAGE_TYPES)[number];
const DamageTypeSchema = z.enum(DAMAGE_TYPES as unknown as [DamageType, ...DamageType[]]);

export const MonsterSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
	baseAttributes: BaseAttributesSchema,
	hp: z.number(),
	armorClass: z.number(),
	tileId: z.number(),
	xpReward: z.number(),
	combatStrategy: z.enum(["melee", "ranged"]),
	/** Idle behaviour when the monster has no enemies to fight. Defaults to stationary. */
	idleStrategy: z.enum(["stationary", "roam", "follow"]).default("stationary"),
	/** Challenge rating used to approximate monster proficiency bonus. */
	challengeRating: z.number(),
	/** Saving throw proficiencies this monster is trained in. */
	savingThrowProficiencies: z.array(AbilityNameSchema),
	damageResistances: z.array(DamageTypeSchema).default([]),
	damageImmunities: z.array(DamageTypeSchema).default([]),
	/** CSS hex colour for blood/death particle effects. */
	bloodColor: z.string(),
	/** Skill IDs this monster spawns with. Each skill starts with cooldownRemaining: 0. */
	skills: z.array(z.string()).default([]),
});

export type MonsterDefinition = z.infer<typeof MonsterSchema>;

export type MonsterId = MonsterDefinition["id"];

export const MonstersArraySchema = z.array(MonsterSchema);
