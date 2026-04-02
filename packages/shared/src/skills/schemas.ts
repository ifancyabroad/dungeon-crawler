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
import { DAMAGE_TYPES } from "../config/combat";
import { SKILL_TAGS, SKILL_SCHOOLS } from "../config/skills";
export type { SkillTag, SkillSchool } from "../config/skills";

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
	 * "self" (default) = caster; "target" = the targeted actor;
	 * "aoe" = all alive actors within aoeRadiusTiles of the caster (excluding the caster).
	 */
	target: z.enum(["self", "target", "aoe"]).optional(),
	/**
	 * Chebyshev radius used when target === "aoe". Required when target is "aoe".
	 */
	aoeRadiusTiles: z.number().int().min(0).optional(),
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

const OnHitStatusSchema = z.object({
	statusId: z.string(),
	durationTurns: z.number().int().min(1),
	/** Optional magnitude forwarded to the ActiveEffect (e.g. DoT damage per turn). */
	value: z.number().optional(),
});

export const SingleTargetDamageEffectSchema = z.object({
	type: z.literal("single_target_damage"),
	dice: z.string(),
	damageType: DamageTypeSchema,
	scalingStat: AbilityNameSchema.optional(),
	savingThrow: SavingThrowConfigSchema.optional(),
	attackRoll: AttackRollConfigSchema.optional(),
	/** If set, applies this status to the target on a successful hit. */
	onHitStatus: OnHitStatusSchema.optional(),
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

export const HealSelfEffectSchema = z.object({
	type: z.literal("heal_self"),
	dice: z.string(),
	/** Optional ability modifier added to the heal roll (e.g. "constitution" for Second Wind). */
	scalingStat: AbilityNameSchema.optional(),
});

export const HealTargetEffectSchema = z.object({
	type: z.literal("heal_target"),
	dice: z.string(),
	/** Optional ability modifier added to the heal roll (e.g. "wisdom" for Cure Wounds). */
	scalingStat: AbilityNameSchema.optional(),
});

export const PushActorEffectSchema = z.object({
	type: z.literal("push_actor"),
	/** Maximum tiles to push the target away from the caster in a straight cardinal direction. */
	maxPushTiles: z.number().int().min(1),
	/**
	 * Optional damage dealt if the target is stopped by a wall or occupied tile.
	 * Wall collision in the real world hurts.
	 */
	wallDamageDice: z.string().optional(),
	wallDamageType: DamageTypeSchema.optional(),
});

export const DrainLifeEffectSchema = z.object({
	type: z.literal("drain_life"),
	dice: z.string(),
	damageType: DamageTypeSchema,
	/** Dice rolled independently to determine how much HP the caster recovers. */
	healDice: z.string(),
});

export const MultiStrikeEffectSchema = z.object({
	type: z.literal("multi_strike"),
	/** How many separate attack rolls to make against the target. */
	strikeCount: z.number().int().min(2).max(10),
	/** Damage dice per strike (e.g. "1d6"). */
	dice: z.string(),
	damageType: DamageTypeSchema,
	/** Optional ability modifier added to each strike's damage (defaults to STR modifier). */
	scalingStat: AbilityNameSchema.optional(),
	/** If set, applies this status to the target on each successful strike. */
	onHitStatus: OnHitStatusSchema.optional(),
});

export const TeleportSwapEffectSchema = z.object({
	type: z.literal("teleport_swap"),
});

export const RemoveStatusEffectSchema = z.object({
	type: z.literal("remove_status"),
	/** Status IDs to strip from the target. All listed IDs are removed in a single application. */
	statusIds: z.array(z.string()).min(1),
	/**
	 * Who loses the status effects.
	 * "self" (default) = caster; "target" = targeted actor; "aoe" = all within aoeRadiusTiles.
	 */
	target: z.enum(["self", "target", "aoe"]).optional(),
	aoeRadiusTiles: z.number().int().min(0).optional(),
});

export const ReduceCooldownsEffectSchema = z.object({
	type: z.literal("reduce_cooldowns"),
	/** Number of turns to subtract from cooldownRemaining (clamped at 0). */
	amount: z.number().int().min(1),
	/** If provided, only these skill IDs are affected. Omit to reduce all skills. */
	skillIds: z.array(z.string()).optional(),
});

export const ModifyNumericBuffEffectSchema = z.object({
	type: z.literal("modify_numeric_buff"),
	/** The numericBuffs key to operate on (e.g. "shieldHp", "wardStacks"). */
	key: z.string(),
	operation: z.enum(["set", "add", "clamp_min", "clamp_max"]),
	value: z.number(),
	/** "self" (default) = caster; "target" = targeted actor. */
	target: z.enum(["self", "target"]).optional(),
});

export const PullActorEffectSchema = z.object({
	type: z.literal("pull_actor"),
	/** Maximum tiles to pull the target toward the caster in a straight cardinal direction. */
	maxPullTiles: z.number().int().min(1),
	/**
	 * Optional damage dealt if the target is stopped by a wall or occupied tile.
	 */
	wallDamageDice: z.string().optional(),
	wallDamageType: DamageTypeSchema.optional(),
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
	HealSelfEffectSchema,
	HealTargetEffectSchema,
	PushActorEffectSchema,
	DrainLifeEffectSchema,
	MultiStrikeEffectSchema,
	TeleportSwapEffectSchema,
	RemoveStatusEffectSchema,
	ReduceCooldownsEffectSchema,
	ModifyNumericBuffEffectSchema,
	PullActorEffectSchema,
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
export type HealSelfEffect = z.infer<typeof HealSelfEffectSchema>;
export type HealTargetEffect = z.infer<typeof HealTargetEffectSchema>;
export type PushActorEffect = z.infer<typeof PushActorEffectSchema>;
export type DrainLifeEffect = z.infer<typeof DrainLifeEffectSchema>;
export type MultiStrikeEffect = z.infer<typeof MultiStrikeEffectSchema>;
export type TeleportSwapEffect = z.infer<typeof TeleportSwapEffectSchema>;
export type RemoveStatusEffect = z.infer<typeof RemoveStatusEffectSchema>;
export type ReduceCooldownsEffect = z.infer<typeof ReduceCooldownsEffectSchema>;
export type ModifyNumericBuffEffect = z.infer<typeof ModifyNumericBuffEffectSchema>;
export type PullActorEffect = z.infer<typeof PullActorEffectSchema>;

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
	appliesTo: z.enum(["melee", "area", "ranged", "any"]),
	onCritOnly: z.boolean(),
});

export const AddStatusImmunityEffectSchema = z.object({
	type: z.literal("add_status_immunity"),
	statusId: z.string(),
});

export const ModifyMaxHpEffectSchema = z.object({
	type: z.literal("modify_max_hp"),
	/** Flat amount added to both max HP and current HP. */
	amount: z.number().int().min(1),
});

export const ModifyHitDieEffectSchema = z.object({
	type: z.literal("modify_hit_die"),
	/** New hit die size (e.g. 10 for d10, 12 for d12). Must be larger than the current die. */
	die: z.number().int().min(4).max(12),
});

export const AddSavingThrowProficiencyEffectSchema = z.object({
	type: z.literal("add_saving_throw_proficiency"),
	ability: AbilityNameSchema,
});

export const AddAttackRollBonusEffectSchema = z.object({
	type: z.literal("add_attack_roll_bonus"),
	/** Flat bonus stacked onto actor.attackBonusFlat. */
	amount: z.number().int().min(1),
});

export const ModifyCritThresholdEffectSchema = z.object({
	type: z.literal("modify_crit_threshold"),
	/** How many points to lower the crit threshold (1 = crit on 19+, 2 = 18+). */
	reduction: z.number().int().min(1).max(10),
});

export const AddDamageVulnerabilityEffectSchema = z.object({
	type: z.literal("add_damage_vulnerability"),
	damageType: DamageTypeSchema,
});

export const AddHealingBonusFlatEffectSchema = z.object({
	type: z.literal("add_healing_bonus_flat"),
	/** Flat HP added to every heal performed by the actor. Stacks additively. */
	amount: z.number().int().min(1),
});

export const AddDotAmplifyFlatEffectSchema = z.object({
	type: z.literal("add_dot_amplify_flat"),
	/** Flat amount added to the per-turn damage of every DoT the actor applies. Stacks additively. */
	amount: z.number().int().min(1),
});

export const PassiveSkillEffectDescriptorSchema = z.discriminatedUnion("type", [
	ModifyAttributeEffectSchema,
	ModifyArmorClassEffectSchema,
	AddDamageResistanceEffectSchema,
	AddDamageImmunityEffectSchema,
	AddDamageDiceEffectSchema,
	AddStatusImmunityEffectSchema,
	ModifyMaxHpEffectSchema,
	ModifyHitDieEffectSchema,
	AddSavingThrowProficiencyEffectSchema,
	AddAttackRollBonusEffectSchema,
	ModifyCritThresholdEffectSchema,
	AddDamageVulnerabilityEffectSchema,
	AddHealingBonusFlatEffectSchema,
	AddDotAmplifyFlatEffectSchema,
]);

export type PassiveSkillEffectDescriptor = z.infer<typeof PassiveSkillEffectDescriptorSchema>;

export type ModifyAttributeEffect = z.infer<typeof ModifyAttributeEffectSchema>;
export type ModifyArmorClassEffect = z.infer<typeof ModifyArmorClassEffectSchema>;
export type AddDamageResistanceEffect = z.infer<typeof AddDamageResistanceEffectSchema>;
export type AddDamageImmunityEffect = z.infer<typeof AddDamageImmunityEffectSchema>;
export type AddDamageDiceEffect = z.infer<typeof AddDamageDiceEffectSchema>;
export type AddStatusImmunityEffect = z.infer<typeof AddStatusImmunityEffectSchema>;
export type ModifyMaxHpEffect = z.infer<typeof ModifyMaxHpEffectSchema>;
export type ModifyHitDieEffect = z.infer<typeof ModifyHitDieEffectSchema>;
export type AddSavingThrowProficiencyEffect = z.infer<typeof AddSavingThrowProficiencyEffectSchema>;
export type AddAttackRollBonusEffect = z.infer<typeof AddAttackRollBonusEffectSchema>;
export type ModifyCritThresholdEffect = z.infer<typeof ModifyCritThresholdEffectSchema>;
export type AddDamageVulnerabilityEffect = z.infer<typeof AddDamageVulnerabilityEffectSchema>;
export type AddHealingBonusFlatEffect = z.infer<typeof AddHealingBonusFlatEffectSchema>;
export type AddDotAmplifyFlatEffect = z.infer<typeof AddDotAmplifyFlatEffectSchema>;

// ---------------------------------------------------------------------------
// Skill classification schemas (raw constants and types live in config/skills)
// ---------------------------------------------------------------------------

type SkillTag = (typeof SKILL_TAGS)[number];
const SkillTagSchema = z.enum(SKILL_TAGS as unknown as [SkillTag, ...SkillTag[]]);

type SkillSchool = (typeof SKILL_SCHOOLS)[number];
const SkillSchoolSchema = z.enum(SKILL_SCHOOLS as unknown as [SkillSchool, ...SkillSchool[]]);

// ---------------------------------------------------------------------------
// Skill definition schemas
// ---------------------------------------------------------------------------

const ActiveEffectsArraySchema = z.array(ActiveSkillEffectDescriptorSchema).min(1);
const PassiveEffectsArraySchema = z.array(PassiveSkillEffectDescriptorSchema).min(1);

export const ActiveSkillDefinitionSchema = z.object({
	skillType: z.literal("active"),
	id: z.string(),
	name: z.string(),
	description: z.string(),
	school: SkillSchoolSchema,
	tags: z.array(SkillTagSchema).min(1),
	cooldown: z.number().int().min(0),
	targetType: z.enum(["none", "tile", "actor"]),
	range: z.number().int().min(1).optional(),
	maintainsStealth: z.boolean().optional(),
	/** Full effects for each skill rank (index 0 = rank 1, index 1 = rank 2, index 2 = rank 3). */
	effectsByRank: z.tuple([
		ActiveEffectsArraySchema,
		ActiveEffectsArraySchema,
		ActiveEffectsArraySchema,
	]),
});
export type ActiveSkillDefinition = z.infer<typeof ActiveSkillDefinitionSchema>;

export const PassiveSkillDefinitionSchema = z.object({
	skillType: z.literal("passive"),
	id: z.string(),
	name: z.string(),
	description: z.string(),
	school: SkillSchoolSchema,
	tags: z.array(SkillTagSchema).min(1),
	/** Full effects for each skill rank (index 0 = rank 1, index 1 = rank 2, index 2 = rank 3). */
	effectsByRank: z.tuple([
		PassiveEffectsArraySchema,
		PassiveEffectsArraySchema,
		PassiveEffectsArraySchema,
	]),
});
export type PassiveSkillDefinition = z.infer<typeof PassiveSkillDefinitionSchema>;

export const SkillDefinitionSchema = z.discriminatedUnion("skillType", [
	ActiveSkillDefinitionSchema,
	PassiveSkillDefinitionSchema,
]);
export type SkillDefinition = z.infer<typeof SkillDefinitionSchema>;
