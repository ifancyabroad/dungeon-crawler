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

export const AbilityNameSchema = z.enum([
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

export const CombatAdjustmentsSchema = z.object({
	/**
	 * Flat additive adjustment to melee damage output while this effect is active.
	 * Positive = bonus damage; negative = reduced damage.
	 */
	meleeDamageFlat: z.object({ damageType: DamageTypeSchema, amount: z.number() }).optional(),
	/**
	 * Flat additive adjustment to all incoming damage while this effect is active.
	 * Positive = more damage taken (vulnerability); negative = less damage taken (resistance).
	 */
	incomingDamageFlat: z.number().optional(),
	/**
	 * Extra dice rolled and ADDED to attack rolls (e.g. Bless: "1d4").
	 * Rolled at resolution time using the game RNG.
	 */
	attackRollDiceBonus: z.string().optional(),
	/**
	 * Extra dice rolled and SUBTRACTED from attack rolls (e.g. Bane: "1d4").
	 * Rolled at resolution time using the game RNG.
	 */
	attackRollDicePenalty: z.string().optional(),
	/**
	 * Extra dice rolled and ADDED to saving throw totals (e.g. Bless: "1d4").
	 */
	savingThrowDiceBonus: z.string().optional(),
	/**
	 * Extra dice rolled and SUBTRACTED from saving throw totals (e.g. Bane: "1d4").
	 */
	savingThrowDicePenalty: z.string().optional(),
	/**
	 * Flat additive adjustment to the defender's AC while this effect is active.
	 * Positive = harder to hit (Shield of Faith); negative = easier to hit.
	 */
	acBonus: z.number().optional(),
	/**
	 * Flat additive adjustment to ranged/single-target skill damage output.
	 * Mirrors meleeDamageFlat but applies to single_target_damage skill attacks.
	 */
	rangedDamageFlat: z.object({ damageType: DamageTypeSchema, amount: z.number() }).optional(),
	/**
	 * Flat additive adjustment to area-of-effect skill damage output (fireball, cone, etc.).
	 * Mirrors meleeDamageFlat but applies to area_damage skill attacks.
	 */
	areaDamageFlat: z.object({ damageType: DamageTypeSchema, amount: z.number() }).optional(),
	/**
	 * When true the attacker rolls 2d20 and takes the higher result for this attack.
	 * Any advantage + any disadvantage cancel out (standard 5E rule).
	 */
	hasAdvantage: z.boolean().optional(),
	/**
	 * When true the attacker rolls 2d20 and takes the lower result for this attack.
	 */
	hasDisadvantage: z.boolean().optional(),
});
export type CombatAdjustments = z.infer<typeof CombatAdjustmentsSchema>;

export const ActiveEffectSchema = z.object({
	id: z.string(),
	remainingTurns: z.number().int().min(0),
	/** Optional magnitude for parameterised effects (e.g. damage per turn for DoT). */
	value: z.number().optional(),
	/**
	 * Inline numeric combat adjustments copied from the skill JSON at application time.
	 * Consulted at resolution (combat, damage) so no registry lookup is needed.
	 * Only present on data-driven status effects (e.g. berserk).
	 * ID-driven hooks (poisoned, stealth) leave this undefined.
	 */
	adjustments: CombatAdjustmentsSchema.optional(),
});

export const PassiveDamageBonusSchema = z.object({
	dice: z.string(),
	damageType: DamageTypeSchema,
	/** "melee" = weapon attacks; "area" = AoE skills; "ranged" = single-target skill attacks; "any" = all. */
	appliesTo: z.enum(["melee", "area", "ranged", "any"]),
	onCritOnly: z.boolean(),
});

export const ActorDefSchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("hero"), classId: z.string() }),
	z.object({ type: z.literal("npc"), npcId: z.string() }),
]);

export const NpcAIStateSchema = z.object({
	combatStrategy: z.enum(["melee", "frightened", "ranged"]),
	idleStrategy: z.enum(["stationary", "roam", "follow"]),
	lastKnownEnemyIdx: z.number().optional(),
	followTargetId: z.string().optional(),
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
	activeEffects: z.array(ActiveEffectSchema).default([]),
	numericBuffs: z.record(z.string(), z.number()).default({}),
	passiveDamageBonuses: z.array(PassiveDamageBonusSchema).default([]),
	statusImmunities: z.array(z.string()).default([]),
	savingThrowProficiencies: z.array(AbilityNameSchema).default([]),
	challengeRating: z.number().optional(),
	/** Natural roll threshold for a critical hit (default 20; lower = crit on more rolls). */
	critThreshold: z.number().int().min(1).max(20).optional(),
	/** Flat bonus added to every attack roll. Set by add_attack_roll_bonus passive. */
	attackBonusFlat: z.number().optional(),
	/** Faction tag. "player" = hero side; "hostile" = enemy side. Defaults derived from def.type. */
	faction: z.enum(["player", "hostile"]).optional(),
	def: ActorDefSchema,
	level: z.number(),
	xp: z.number(),
	hitDie: z.number(),
	xpReward: z.number(),
	aiState: NpcAIStateSchema.optional(),
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
