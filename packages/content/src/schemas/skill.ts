/**
 * Zod schema and types for skill definitions.
 * Skills are data-driven: each skill declares typed effect descriptors
 * that the shared engine resolves at runtime.
 *
 * Active skills are used via the hotbar and resolved by the use_skill action.
 * Passive skills are granted at level-up and apply permanent buffs to the hero.
 *
 * To add a new active effect type:
 * 1. Add a new variant to ActiveSkillEffectDescriptorSchema.
 * 2. Add a handler in packages/shared/src/skills/effects/.
 * 3. Author JSON files in src/raw/skills/ with skillType: "active".
 *
 * To add a new passive effect type:
 * 1. Add a new variant to PassiveSkillEffectDescriptorSchema.
 * 2. Add a case in packages/shared/src/skills/applyPassiveEffect.ts.
 * 3. Author JSON files in src/raw/skills/ with skillType: "passive".
 */

import { z } from "zod";

import { AbilityNameSchema, DAMAGE_TYPES } from "@app/shared";

type DamageType = (typeof DAMAGE_TYPES)[number];
const DamageTypeSchema = z.enum(DAMAGE_TYPES as unknown as [DamageType, ...DamageType[]]);

// ---------------------------------------------------------------------------
// Active skill effect descriptors
// ---------------------------------------------------------------------------

const SavingThrowConfigSchema = z.object({
	/** Defender saving throw ability (e.g. Dexterity). */
	saveAbility: AbilityNameSchema,
	/** Caster ability used to compute the save DC modifier. */
	dcStat: AbilityNameSchema,
	/** Damage multiplier applied on a successful save (0.5 = half damage). */
	successDamageMultiplier: z.number().min(0).max(1).default(0.5),
});

const AreaDamageEffectSchema = z.object({
	type: z.literal("area_damage"),
	/** Dice expression e.g. "2d6". Rolled once per target hit. */
	dice: z.string(),
	/** Manhattan / Chebyshev radius of the blast (0 = single tile). */
	radiusTiles: z.number().int().min(0),
	/** Attribute whose modifier is added to each damage roll. */
	scalingStat: AbilityNameSchema.optional(),
	damageType: DamageTypeSchema,
	/** Optional saving throw applied per target (e.g. half damage on success). */
	savingThrow: SavingThrowConfigSchema.optional(),
});

/** Applies a named status effect to the caster for a number of turns. */
const ApplyStatusEffectSchema = z.object({
	type: z.literal("apply_status"),
	/** Identifier consumed by the engine (e.g. "stealth"). */
	statusId: z.string(),
	durationTurns: z.number().int().min(1),
});

/** Moves the caster adjacent to a target actor and resolves a melee attack. */
const ChargeAttackEffectSchema = z.object({
	type: z.literal("charge_attack"),
	/** Target must be within this many tiles, in a straight (cardinal) line. */
	maxRangeTiles: z.number().int().min(1),
	/**
	 * Extra damage dice added on a hit, in NdM notation (e.g. "1d8").
	 * Doubled on a critical hit (5e Charger feat). No ability modifier is added —
	 * STR is already included in the base weapon damage roll.
	 */
	bonusDice: z.string(),
	bonusDamageType: DamageTypeSchema,
});

export const ActiveSkillEffectDescriptorSchema = z.discriminatedUnion("type", [
	AreaDamageEffectSchema,
	ApplyStatusEffectSchema,
	ChargeAttackEffectSchema,
]);

export type ActiveSkillEffectDescriptor = z.infer<typeof ActiveSkillEffectDescriptorSchema>;

// ---------------------------------------------------------------------------
// Passive skill effect descriptors
// ---------------------------------------------------------------------------

/** Permanently increases one of the hero's core attributes. */
const ModifyAttributeEffectSchema = z.object({
	type: z.literal("modify_attribute"),
	attribute: AbilityNameSchema,
	amount: z.number().int(),
});

/** Permanently adjusts the hero's armour class. */
const ModifyArmorClassEffectSchema = z.object({
	type: z.literal("modify_armor_class"),
	amount: z.number().int(),
});

/** Grants the hero resistance to a damage type (halves incoming damage). */
const AddDamageResistanceEffectSchema = z.object({
	type: z.literal("add_damage_resistance"),
	damageType: DamageTypeSchema,
});

/** Grants the hero full immunity to a damage type. */
const AddDamageImmunityEffectSchema = z.object({
	type: z.literal("add_damage_immunity"),
	damageType: DamageTypeSchema,
});

/**
 * Adds extra damage dice of a specific type to every qualifying hit.
 * Applied as an additional damage packet so defender resistances/immunities apply.
 * When onCritOnly is true, the bonus only fires on a critical hit.
 */
const AddDamageDiceEffectSchema = z.object({
	type: z.literal("add_damage_dice"),
	/** Dice expression, e.g. "1d6". */
	dice: z.string(),
	damageType: DamageTypeSchema,
	/** Which attack types this bonus applies to. */
	appliesTo: z.enum(["melee", "area", "any"]).default("any"),
	/** If true, only adds dice on a critical hit. */
	onCritOnly: z.boolean().default(false),
});

/** Grants immunity to a specific status effect (silently ignored when applied). */
const AddStatusImmunityEffectSchema = z.object({
	type: z.literal("add_status_immunity"),
	statusId: z.string(),
});

export const PassiveSkillEffectDescriptorSchema = z.discriminatedUnion("type", [
	ModifyAttributeEffectSchema,
	ModifyArmorClassEffectSchema,
	AddDamageResistanceEffectSchema,
	AddDamageImmunityEffectSchema,
	AddDamageDiceEffectSchema,
	AddStatusImmunityEffectSchema,
]);

export type PassiveSkillEffectDescriptor = z.infer<typeof PassiveSkillEffectDescriptorSchema>;

// ---------------------------------------------------------------------------
// Skill definitions — discriminated by skillType
// ---------------------------------------------------------------------------

export const ActiveSkillDefinitionSchema = z.object({
	skillType: z.literal("active"),
	id: z.string(),
	name: z.string(),
	description: z.string(),
	/** Number of turns the player must wait before using this skill again (0 = no cooldown). */
	cooldown: z.number().int().min(0),
	/**
	 * How the player selects a target before using this skill.
	 * - "none"  – no target required; activates immediately.
	 * - "tile"  – player selects a map tile (e.g. fireball destination).
	 * - "actor" – player selects a visible actor (e.g. charge target).
	 */
	targetType: z.enum(["none", "tile", "actor"]),
	/** Maximum tile range for tile/actor targeting. Ignored when targetType is "none". */
	range: z.number().int().min(1).optional(),
	/**
	 * When true, using this skill does NOT remove the "stealth" status effect from the caster.
	 * Default false — most active skills reveal the hero.
	 */
	maintainsStealth: z.boolean().optional(),
	effects: z.array(ActiveSkillEffectDescriptorSchema).min(1),
});

export type ActiveSkillDefinition = z.infer<typeof ActiveSkillDefinitionSchema>;

export const PassiveSkillDefinitionSchema = z.object({
	skillType: z.literal("passive"),
	id: z.string(),
	name: z.string(),
	description: z.string(),
	effects: z.array(PassiveSkillEffectDescriptorSchema).min(1),
});

export type PassiveSkillDefinition = z.infer<typeof PassiveSkillDefinitionSchema>;

export const SkillDefinitionSchema = z.discriminatedUnion("skillType", [
	ActiveSkillDefinitionSchema,
	PassiveSkillDefinitionSchema,
]);

export type SkillDefinition = z.infer<typeof SkillDefinitionSchema>;

export type SkillId = SkillDefinition["id"];

export const SkillsArraySchema = z.array(SkillDefinitionSchema);
