/**
 * Zod schemas for game state and snapshot validation.
 * Used by API to validate persisted snapshot state (including RngState).
 */

import { z } from "zod";
import { ATTACK_CATEGORIES, DAMAGE_TYPES } from "../config/combat";

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
	rank: z.number().int().min(1),
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
	/**
	 * Extra dice rolled and ADDED to melee damage output.
	 * Mirrors meleeDamageFlat but uses a dice expression instead of a fixed amount.
	 */
	meleeDamageDiceBonus: z.string().optional(),
	/**
	 * Extra dice rolled and ADDED to single-target skill (ranged) damage output.
	 */
	rangedDamageDiceBonus: z.string().optional(),
	/**
	 * Extra dice rolled and ADDED to area-of-effect skill damage output.
	 */
	areaDamageDiceBonus: z.string().optional(),
	/**
	 * Reduces the caster's effective crit threshold for this turn.
	 * Stacks additively with the permanent modify_crit_threshold passive.
	 */
	critThresholdReduction: z.number().int().min(1).max(10).optional(),
	/**
	 * Flat bonus added to the saving throw DC the caster imposes.
	 */
	saveDcBonusFlat: z.number().int().optional(),
	/**
	 * Flat bonus added to all healing the actor performs while this effect is active.
	 */
	healingDoneFlat: z.number().int().optional(),
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
	/**
	 * The skill that applied this effect. Set for data-driven statuses applied via
	 * `apply_status` effect descriptors. Undefined for STATUS_HOOKS applied directly
	 * by the engine (e.g. environmental effects, NPC attacks).
	 */
	sourceSkillId: z.string().optional(),
});

export const PassiveDamageBonusSchema = z.object({
	dice: z.string(),
	damageType: DamageTypeSchema,
	/** Matched against the current effect's attackCategory. "any" fires on all attacks. */
	appliesTo: z.enum(ATTACK_CATEGORIES),
	onCritOnly: z.boolean(),
	sourceSkillId: z.string().optional(),
	sourceItemInstanceId: z.string().optional(),
	/** If set, only fires when the attack's primary damage type matches. */
	requiredDamageType: DamageTypeSchema.optional(),
});

export const PassiveFlatDamageBonusSchema = z.object({
	amount: z.number().int().min(1),
	/** The damage type this bonus adds. */
	damageType: DamageTypeSchema,
	/** Matched against the current effect's attackCategory. "any" fires on all attacks. */
	appliesTo: z.enum(ATTACK_CATEGORIES),
	sourceSkillId: z.string().optional(),
	sourceItemInstanceId: z.string().optional(),
	/** If set, only fires when the attack's primary damage type matches. */
	requiredDamageType: DamageTypeSchema.optional(),
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

const EquipmentSlotsSchema = z.object({
	mainHand: z.string().optional(),
	offHand: z.string().optional(),
	body: z.string().optional(),
	head: z.string().optional(),
	hands: z.string().optional(),
	feet: z.string().optional(),
	ring1: z.string().optional(),
	ring2: z.string().optional(),
	amulet: z.string().optional(),
});

const WeaponDiceSchema = z.object({
	dice: z.string(),
	damageType: DamageTypeSchema,
});

const NaturalWeaponSchema = z.object({
	name: z.string(),
	damageDice: z.string(),
	damageType: DamageTypeSchema,
	attackStat: z.enum(["strength", "dexterity"]),
});

const ItemInstanceSchema = z.object({
	instanceId: z.string(),
	baseItemId: z.string(),
	rarity: z.enum(["common", "uncommon", "rare", "epic", "unique"]),
	enhancementBonus: z.number(),
	affixIds: z.array(z.string()),
	generatedName: z.string(),
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
	damageVulnerabilities: z.array(DamageTypeSchema).default([]),
	skills: z.record(z.string(), ActorSkillStateSchema),
	activeEffects: z.array(ActiveEffectSchema).default([]),
	numericBuffs: z.record(z.string(), z.number()).default({}),
	passiveDamageBonuses: z.array(PassiveDamageBonusSchema).default([]),
	passiveFlatDamageBonuses: z.array(PassiveFlatDamageBonusSchema).default([]),
	statusImmunities: z.array(z.string()).default([]),
	savingThrowProficiencies: z.array(AbilityNameSchema).default([]),
	challengeRating: z.number().optional(),
	/** Natural roll threshold for a critical hit (default 20; lower = crit on more rolls). */
	critThreshold: z.number().int().min(1).max(20).optional(),
	/** Flat bonus added to every attack roll. Set by add_attack_roll_bonus passive. */
	attackBonusFlat: z.number().optional(),
	/** Flat bonus added to all healing performed. Set by add_healing_bonus_flat passive. */
	healingBonusFlat: z.number().optional(),
	/** Flat DoT amplification — added to `value` of every DoT the actor applies. */
	dotAmplifyFlat: z.number().optional(),
	/** Faction tag. "player" = hero side; "hostile" = enemy side. Defaults derived from def.type. */
	faction: z.enum(["player", "hostile"]).optional(),
	def: ActorDefSchema,
	level: z.number(),
	xp: z.number(),
	hitDie: z.number(),
	xpReward: z.number(),
	aiState: NpcAIStateSchema.optional(),
	equipment: EquipmentSlotsSchema,
	weaponProficiencies: z.array(z.string()),
	armorProficiencies: z.array(z.string()),
	naturalWeapon: NaturalWeaponSchema.optional(),
	equippedWeaponDice: WeaponDiceSchema,
	equippedAttackStat: z.enum(["strength", "dexterity"]),
	equippedWeaponFinesse: z.boolean(),
	weaponProficient: z.boolean(),
	armorProficient: z.boolean(),
	gold: z.number().default(0),
	itemInstances: z.record(z.string(), ItemInstanceSchema).default({}),
	itemAttackBonusFlat: z.number().default(0),
	itemAcBonus: z.number().default(0),
	lootTable: z
		.object({
			dropChance: z.number(),
			gold: z.object({ min: z.number(), max: z.number() }).optional(),
			items: z.array(z.object({ baseItemId: z.string(), weight: z.number() })).optional(),
			rarityWeights: z.record(z.string(), z.number()).optional(),
		})
		.optional(),
});

export const ActorsByIdSchema = z.record(z.string(), ActorSchema);

const LootDropSchema = z.object({
	gold: z.number().optional(),
	items: z.array(ItemInstanceSchema),
});

/** tileOverrides: keys are stringified numbers (cell index) when parsed from JSON. */
export const FloorStateSchema = z.object({
	tileOverrides: z.record(z.string(), z.number()),
	actorsById: ActorsByIdSchema,
	explored: z.array(z.number()),
	spawnIdx: z.number(),
	exitIdx: z.number().nullable(),
	lootByIdx: z.record(z.string(), LootDropSchema).default({}),
});

export const SkillOfferSchema = z.object({
	skillId: z.string(),
	rank: z.number().int().min(1).max(3),
});

export const PendingInteractionSchema = z
	.discriminatedUnion("type", [
		z.object({
			type: z.literal("skill_choice"),
			levelReached: z.number(),
			hpGained: z.number(),
			offers: z.array(SkillOfferSchema),
			rerollsUsed: z.number(),
			rerollCost: z.number(),
		}),
		z.object({
			type: z.literal("loot_pickup"),
			tileIdx: z.number().int().min(0),
			loot: LootDropSchema,
		}),
	])
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
