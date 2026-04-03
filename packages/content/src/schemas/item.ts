/**
 * Zod schema and types for item definitions.
 * Covers weapons, armor, shields, and accessories.
 *
 * Re-exports ItemDef types from @app/shared so buildContent.ts has a single
 * local import path, consistent with the skill.ts schema pattern.
 */

import { z } from "zod";
import { DAMAGE_TYPES, PassiveSkillEffectDescriptorSchema } from "@app/shared";

export type {
	ItemDef,
	WeaponItemDef,
	ArmorItemDef,
	ShieldItemDef,
	AccessoryItemDef,
} from "@app/shared";

type DamageType = (typeof DAMAGE_TYPES)[number];
const DamageTypeSchema = z.enum(DAMAGE_TYPES as unknown as [DamageType, ...DamageType[]]);

const WeaponCategorySchema = z.enum([
	"sword",
	"axe",
	"mace",
	"dagger",
	"staff",
	"polearm",
	"shortbow",
	"longbow",
]);

const ArmorCategorySchema = z.enum(["cloth", "light", "medium", "heavy"]);

export const WeaponItemSchema = z.object({
	type: z.literal("weapon"),
	id: z.string(),
	name: z.string(),
	description: z.string().optional(),
	weaponCategory: WeaponCategorySchema,
	/** Dice expression, e.g. "1d8". Consistent with skill JSON format. */
	damageDice: z.string(),
	damageType: DamageTypeSchema,
	properties: z
		.array(z.enum(["finesse", "two_handed", "versatile", "thrown", "light", "ranged"]))
		.default([]),
	/** Two-handed dice for versatile weapons when no off-hand is equipped. */
	versatileDice: z.string().optional(),
});

export const ArmorItemSchema = z.object({
	type: z.literal("armor"),
	id: z.string(),
	name: z.string(),
	description: z.string().optional(),
	/** Which equipment slot this piece of armour occupies. */
	slot: z.enum(["body", "head", "hands", "feet"]),
	armorCategory: ArmorCategorySchema,
	/** Base AC before DEX modifier (if applicable per 5E formulas). */
	baseAC: z.number(),
	strengthRequirement: z.number().optional(),
	stealthDisadvantage: z.boolean().optional(),
});

export const ShieldItemSchema = z.object({
	type: z.literal("shield"),
	id: z.string(),
	name: z.string(),
	description: z.string().optional(),
	acBonus: z.number(),
});

export const AccessoryItemSchema = z.object({
	type: z.literal("accessory"),
	id: z.string(),
	name: z.string(),
	description: z.string().optional(),
	slot: z.enum(["ring", "amulet"]),
	/** Same effect descriptors as passive skills — applied permanently when equipped. */
	effects: z.array(PassiveSkillEffectDescriptorSchema),
});

export const ItemSchema = z.discriminatedUnion("type", [
	WeaponItemSchema,
	ArmorItemSchema,
	ShieldItemSchema,
	AccessoryItemSchema,
]);

export type ItemDefinition = z.infer<typeof ItemSchema>;
export type ItemId = ItemDefinition["id"];

export const ItemsArraySchema = z.array(ItemSchema);
