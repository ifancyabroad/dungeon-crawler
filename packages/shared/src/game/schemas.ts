/**
 * Zod schemas for game state and snapshot validation.
 * Used by API to validate persisted snapshot state (including RngState).
 */

import { z } from "zod";
import { DAMAGE_TYPES } from "../combat/damageTypes";

const DamageTypeSchema = z.enum(DAMAGE_TYPES);

export const RngStateSchema = z.discriminatedUnion("algo", [
	z.object({ algo: z.literal("xorshift32"), s: z.number() }),
	z.object({
		algo: z.literal("sfc32"),
		a: z.number(),
		b: z.number(),
		c: z.number(),
		d: z.number(),
	}),
]);

export const ActorAttributesSchema = z.object({
	strength: z.number(),
	dexterity: z.number(),
	constitution: z.number(),
	intelligence: z.number(),
	wisdom: z.number(),
	charisma: z.number(),
});

const AbilityNameSchema = z.enum([
	"strength",
	"dexterity",
	"constitution",
	"intelligence",
	"wisdom",
	"charisma",
]);

export const ActorSkillStateSchema = z.object({
	level: z.number().optional(),
	cooldownRemaining: z.number(),
});

export const ActiveEffectSchema = z.object({
	id: z.string(),
	remainingTurns: z.number().int().min(0),
});

export const PassiveDamageBonusSchema = z.object({
	dice: z.string(),
	damageType: DamageTypeSchema,
	appliesTo: z.enum(["melee", "area", "any"]),
	onCritOnly: z.boolean(),
});

export const ActorDefSchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("hero"), classId: z.string() }),
	z.object({ type: z.literal("monster"), monsterId: z.string() }),
]);

export const MonsterAIStateSchema = z.object({
	strategy: z.enum(["melee"]),
	lastKnownHeroIdx: z.number().optional(),
});

export const ActorSchema = z.object({
	id: z.string(),
	name: z.string(),
	idx: z.number(),
	alive: z.boolean(),
	hp: z.number(),
	maxHp: z.number(),
	armorClass: z.number(),
	attributes: ActorAttributesSchema,
	damageResistances: z.array(DamageTypeSchema).default([]),
	damageImmunities: z.array(DamageTypeSchema).default([]),
	skills: z.record(z.string(), ActorSkillStateSchema),
	statusEffects: z.array(ActiveEffectSchema).default([]),
	passiveDamageBonuses: z.array(PassiveDamageBonusSchema).default([]),
	statusImmunities: z.array(z.string()).default([]),
	abilityProficiencies: z.array(AbilityNameSchema).default([]),
	challengeRating: z.number().optional(),
	def: ActorDefSchema,
	level: z.number(),
	xp: z.number(),
	hitDie: z.number(),
	xpReward: z.number(),
	aiState: MonsterAIStateSchema.optional(),
});

export const ActorsByIdSchema = z.record(z.string(), ActorSchema);

/** tileOverrides: keys are stringified numbers (cell index) when parsed from JSON. */
export const FloorStateSchema = z.object({
	tileOverrides: z.record(z.string(), z.number()),
	actorsById: ActorsByIdSchema,
	explored: z.array(z.number()),
	spawnIdx: z.number(),
	exitIdx: z.number().nullable(),
});

export const PendingInteractionSchema = z
	.object({
		type: z.literal("skill_choice"),
		offerType: z.enum(["active", "passive"]),
		levelReached: z.number(),
		offers: z.array(z.string()),
		rerollsUsed: z.number(),
	})
	.nullable();

/** Persisted dynamic state; validate snapshots with this (includes RngState). */
export const PersistedDynamicStateSchema = z.object({
	turn: z.number(),
	heroId: z.string(),
	heroFloorIndex: z.number(),
	floors: z.array(FloorStateSchema),
	rngState: RngStateSchema,
	pendingInteraction: PendingInteractionSchema.default(null),
});
