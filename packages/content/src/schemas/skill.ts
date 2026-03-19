/**
 * Zod schema and types for skill definitions.
 * Skills are data-driven: each skill declares typed effect descriptors
 * that the shared engine resolves at runtime.
 *
 * To add a new effect type:
 * 1. Add a new variant to SkillEffectDescriptorSchema (and the SkillEffectDescriptor union).
 * 2. Add a handler in packages/shared/src/skills/effects/.
 * 3. Author JSON files in src/raw/skills/ using the new effect type.
 */

import { z } from "zod";

import { DAMAGE_TYPES } from "@app/shared";

type DamageType = (typeof DAMAGE_TYPES)[number];
const DamageTypeSchema = z.enum(DAMAGE_TYPES as unknown as [DamageType, ...DamageType[]]);

// ---------------------------------------------------------------------------
// Effect descriptors — one variant per skill mechanic
// ---------------------------------------------------------------------------

/** Deals damage to all actors within radiusTiles of a target tile. */
const AreaDamageEffectSchema = z.object({
	type: z.literal("area_damage"),
	/** Dice expression e.g. "2d6". Rolled once per target hit. */
	dice: z.string(),
	/** Manhattan / Chebyshev radius of the blast (0 = single tile). */
	radiusTiles: z.number().int().min(0),
	/** Attribute whose modifier is added to each damage roll. */
	scalingStat: z.enum(["intelligence", "strength"]).optional(),
	damageType: DamageTypeSchema,
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

export const SkillEffectDescriptorSchema = z.discriminatedUnion("type", [
	AreaDamageEffectSchema,
	ApplyStatusEffectSchema,
	ChargeAttackEffectSchema,
]);

export type SkillEffectDescriptor = z.infer<typeof SkillEffectDescriptorSchema>;

// ---------------------------------------------------------------------------
// Skill definition
// ---------------------------------------------------------------------------

export const SkillDefinitionSchema = z.object({
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
	effects: z.array(SkillEffectDescriptorSchema).min(1),
});

export type SkillDefinition = z.infer<typeof SkillDefinitionSchema>;

export type SkillId = SkillDefinition["id"];

export const SkillsArraySchema = z.array(SkillDefinitionSchema);
