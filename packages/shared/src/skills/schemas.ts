/**
 * Zod schemas for active and passive skill definitions.
 * TypeScript types are derived from these schemas via z.infer — this is the
 * single source of truth for skill structure in both the engine and content validation.
 *
 * @app/content imports these schemas for JSON validation in buildContent.ts.
 * @app/shared uses the inferred types throughout the engine.
 */

import { z } from "zod";
import { AbilityNameSchema, CombatAdjustmentsSchema } from "../game/schemas";
import { DAMAGE_TYPES } from "../combat/damageTypes";

type DamageType = (typeof DAMAGE_TYPES)[number];
const DamageTypeSchema = z.enum(DAMAGE_TYPES as unknown as [DamageType, ...DamageType[]]);

// ---------------------------------------------------------------------------
// Shared sub-schemas
// ---------------------------------------------------------------------------

export const SavingThrowConfigSchema = z.object({
	saveAbility: AbilityNameSchema,
	dcStat: AbilityNameSchema,
	/** Damage multiplier on a successful save (default 0.5). */
	successDamageMultiplier: z.number().min(0).max(1).optional(),
});
export type SavingThrowConfig = z.infer<typeof SavingThrowConfigSchema>;

export const AttackRollConfigSchema = z.object({
	modifierStat: AbilityNameSchema,
	useProficiency: z.boolean(),
});
export type AttackRollConfig = z.infer<typeof AttackRollConfigSchema>;

// ---------------------------------------------------------------------------
// Active skill effect descriptor schemas
// ---------------------------------------------------------------------------

export const AreaDamageEffectSchema = z.object({
	type: z.literal("area_damage"),
	dice: z.string(),
	radiusTiles: z.number().int().min(0),
	scalingStat: AbilityNameSchema.optional(),
	damageType: DamageTypeSchema,
	savingThrow: SavingThrowConfigSchema.optional(),
});

export const ApplyStatusEffectSchema = z.object({
	type: z.literal("apply_status"),
	statusId: z.string(),
	durationTurns: z.number().int().min(1),
	/** Optional magnitude stored on the ActiveEffect (e.g. damage per turn for DoT). */
	value: z.number().optional(),
	/**
	 * Who receives the status effect.
	 * "self" (default) = caster; "target" = the targeted actor.
	 */
	target: z.enum(["self", "target"]).optional(),
	/**
	 * Inline numeric combat adjustments for data-driven status effects.
	 * Copied onto the ActiveEffect at application time and consulted at
	 * resolution (combat, damage) — no registry lookup needed.
	 * Omit for ID-driven hooks (poisoned, stealth) whose behaviour is
	 * wired directly in the engine.
	 */
	adjustments: CombatAdjustmentsSchema.optional(),
});

export const ApplyShieldEffectSchema = z.object({
	type: z.literal("apply_shield"),
	amount: z.number().int().min(1),
});

export const ChargeAttackEffectSchema = z.object({
	type: z.literal("charge_attack"),
	maxRangeTiles: z.number().int().min(1),
	bonusDice: z.string(),
	bonusDamageType: DamageTypeSchema,
});

export const LineDamageEffectSchema = z.object({
	type: z.literal("line_damage"),
	dice: z.string(),
	damageType: DamageTypeSchema,
	scalingStat: AbilityNameSchema.optional(),
	savingThrow: SavingThrowConfigSchema.optional(),
});

export const ConeDamageEffectSchema = z.object({
	type: z.literal("cone_damage"),
	dice: z.string(),
	damageType: DamageTypeSchema,
	rangeTiles: z.number().int().min(1),
	/** Total arc in degrees (engine defaults to 90 when absent). */
	angleDegrees: z.number().min(1).max(360).optional(),
	scalingStat: AbilityNameSchema.optional(),
	savingThrow: SavingThrowConfigSchema.optional(),
});

export const SingleTargetDamageEffectSchema = z.object({
	type: z.literal("single_target_damage"),
	dice: z.string(),
	damageType: DamageTypeSchema,
	scalingStat: AbilityNameSchema.optional(),
	savingThrow: SavingThrowConfigSchema.optional(),
	attackRoll: AttackRollConfigSchema.optional(),
});

export const LeapAttackEffectSchema = z.object({
	type: z.literal("leap_attack"),
	maxRangeTiles: z.number().int().min(1),
	landingRadiusTiles: z.number().int().min(0),
	dice: z.string(),
	damageType: DamageTypeSchema,
	scalingStat: AbilityNameSchema.optional(),
});

export const SneakAttackEffectSchema = z.object({
	type: z.literal("sneak_attack"),
	dice: z.string(),
	damageType: DamageTypeSchema,
});

export const ShadowStepEffectSchema = z.object({
	type: z.literal("shadow_step"),
});

export const ActiveSkillEffectDescriptorSchema = z.discriminatedUnion("type", [
	AreaDamageEffectSchema,
	ApplyStatusEffectSchema,
	ApplyShieldEffectSchema,
	ChargeAttackEffectSchema,
	LeapAttackEffectSchema,
	LineDamageEffectSchema,
	ConeDamageEffectSchema,
	SingleTargetDamageEffectSchema,
	SneakAttackEffectSchema,
	ShadowStepEffectSchema,
]);

export type ActiveSkillEffectDescriptor = z.infer<typeof ActiveSkillEffectDescriptorSchema>;

// Convenience re-exports for individual effect types used by effect handlers.
export type AreaDamageEffect = z.infer<typeof AreaDamageEffectSchema>;
export type ApplyStatusEffect = z.infer<typeof ApplyStatusEffectSchema>;
export type ApplyShieldEffect = z.infer<typeof ApplyShieldEffectSchema>;
export type ChargeAttackEffect = z.infer<typeof ChargeAttackEffectSchema>;
export type LineDamageEffect = z.infer<typeof LineDamageEffectSchema>;
export type ConeDamageEffect = z.infer<typeof ConeDamageEffectSchema>;
export type SingleTargetDamageEffect = z.infer<typeof SingleTargetDamageEffectSchema>;
export type LeapAttackEffect = z.infer<typeof LeapAttackEffectSchema>;
export type SneakAttackEffect = z.infer<typeof SneakAttackEffectSchema>;
export type ShadowStepEffect = z.infer<typeof ShadowStepEffectSchema>;

// ---------------------------------------------------------------------------
// Passive skill effect descriptor schemas
// ---------------------------------------------------------------------------

export const ModifyAttributeEffectSchema = z.object({
	type: z.literal("modify_attribute"),
	attribute: AbilityNameSchema,
	amount: z.number().int(),
});

export const ModifyArmorClassEffectSchema = z.object({
	type: z.literal("modify_armor_class"),
	amount: z.number().int(),
});

export const AddDamageResistanceEffectSchema = z.object({
	type: z.literal("add_damage_resistance"),
	damageType: DamageTypeSchema,
});

export const AddDamageImmunityEffectSchema = z.object({
	type: z.literal("add_damage_immunity"),
	damageType: DamageTypeSchema,
});

export const AddDamageDiceEffectSchema = z.object({
	type: z.literal("add_damage_dice"),
	dice: z.string(),
	damageType: DamageTypeSchema,
	appliesTo: z.enum(["melee", "area", "any"]),
	onCritOnly: z.boolean(),
});

export const AddStatusImmunityEffectSchema = z.object({
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

export type ModifyAttributeEffect = z.infer<typeof ModifyAttributeEffectSchema>;
export type ModifyArmorClassEffect = z.infer<typeof ModifyArmorClassEffectSchema>;
export type AddDamageResistanceEffect = z.infer<typeof AddDamageResistanceEffectSchema>;
export type AddDamageImmunityEffect = z.infer<typeof AddDamageImmunityEffectSchema>;
export type AddDamageDiceEffect = z.infer<typeof AddDamageDiceEffectSchema>;
export type AddStatusImmunityEffect = z.infer<typeof AddStatusImmunityEffectSchema>;

// ---------------------------------------------------------------------------
// Skill definition schemas
// ---------------------------------------------------------------------------

export const ActiveSkillDefinitionSchema = z.object({
	skillType: z.literal("active"),
	id: z.string(),
	name: z.string(),
	description: z.string(),
	cooldown: z.number().int().min(0),
	targetType: z.enum(["none", "tile", "actor"]),
	range: z.number().int().min(1).optional(),
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
