/**
 * Item type definitions. Used by both the engine (for Actor equipment fields)
 * and the content package (for JSON schema validation).
 *
 * Dice expressions (e.g. "1d8") are stored as strings — consistent with skill JSON.
 * The engine converts these to WeaponDice objects via parseDice() when applying equipment.
 */

import type { DamageType } from "../config/combat";
import type { PassiveSkillEffectDescriptor } from "../skills/schemas";

/** Rarity tier for procedurally generated items. Determines enhancement bonus and affix count. */
export type ItemRarity = "common" | "uncommon" | "rare" | "epic" | "unique";

/** Enhancement bonus (+N to attack for weapons, +N to AC for armour) by rarity. */
export const RARITY_ENHANCEMENT: Record<ItemRarity, number> = {
	common: 0,
	uncommon: 1,
	rare: 2,
	epic: 3,
	unique: 5,
};

/** Number of random affixes rolled at generation time by rarity. Uniques have fixed stats; no random affixes. */
export const RARITY_AFFIX_COUNT: Record<ItemRarity, number> = {
	common: 0,
	uncommon: 1,
	rare: 2,
	epic: 3,
	unique: 0,
};

/**
 * An affix definition: a bonus property that can be attached to an item at generation time.
 * Eligible item types constrain which items this affix can appear on.
 * The effect is the same descriptor used by passive skills.
 */
export interface AffixDef {
	id: string;
	name: string;
	/** Prefix used when composing the generated item name (e.g. "Keen" → "Keen Longsword"). */
	namePrefix?: string;
	/** Suffix used when composing the generated item name (e.g. "of Fire" → "Longsword of Fire"). */
	nameSuffix?: string;
	/** Higher priority wins when multiple affixes compete for the same prefix/suffix position. */
	namePriority: number;
	eligibleItemTypes: Array<"weapon" | "armor" | "shield" | "accessory">;
	effect: PassiveSkillEffectDescriptor;
}

/** A fully materialised item produced by procedural generation or a unique drop. */
export interface ItemInstance {
	instanceId: string;
	baseItemId: string;
	rarity: ItemRarity;
	/** +N bonus: attack roll for weapons, AC for armour/shields. */
	enhancementBonus: number;
	/** Ordered list of affix ids applied to this instance. Empty for common items and uniques. */
	affixIds: string[];
	/** Pre-computed display name (e.g. "Keen Longsword of Fire"). */
	generatedName: string;
}

/** A single entry in a loot table's item list. */
export interface LootTableItemEntry {
	baseItemId: string;
	/** Relative weight; higher = more likely to be chosen. */
	weight: number;
}

/** Per-NPC loot table embedded in the NPC definition and stored on Actor at spawn time. */
export interface LootTable {
	/** Probability that anything drops at all (0–1). */
	dropChance: number;
	gold?: { min: number; max: number };
	items?: LootTableItemEntry[];
	/** Relative weights per rarity tier. Higher floors bias toward better rarities in the roller. */
	rarityWeights?: Record<ItemRarity, number>;
}

/** Loot on a floor tile: optional gold amount and zero or more item instances. */
export interface LootDrop {
	gold?: number;
	items: ItemInstance[];
}

/** Weapon categories — must match strings used in class/NPC weaponProficiencies arrays. */
export type WeaponCategory =
	| "sword"
	| "axe"
	| "mace"
	| "dagger"
	| "staff"
	| "polearm"
	| "shortbow"
	| "longbow";

/** Armor category — determines which AC formula applies. */
export type ArmorCategory = "cloth" | "light" | "medium" | "heavy";

/** Weapon item: melee or ranged weapon that occupies the main-hand slot. */
export interface WeaponItemDef {
	type: "weapon";
	id: string;
	name: string;
	description?: string;
	/** Used to check actor weapon proficiency. Must match a string in weaponProficiencies. */
	weaponCategory: WeaponCategory;
	/** Dice expression for damage, e.g. "1d8". Consistent with skill JSON format. */
	damageDice: string;
	damageType: DamageType;
	properties: Array<"finesse" | "two_handed" | "versatile" | "thrown" | "light" | "ranged">;
	/** Dice when wielded two-handed (no off-hand equipped). Only for versatile weapons. */
	versatileDice?: string;
}

/** Armor item: body or extremity armour occupying a specific slot. */
export interface ArmorItemDef {
	type: "armor";
	id: string;
	name: string;
	description?: string;
	/** Which equipment slot this piece of armour occupies. */
	slot: "body" | "head" | "hands" | "feet";
	armorCategory: ArmorCategory;
	/** Base AC before DEX modifier (if applicable). */
	baseAC: number;
	/** Minimum STR required (for heavy armor). Tracked for future enforcement. */
	strengthRequirement?: number;
	stealthDisadvantage?: boolean;
}

/** Shield item: off-hand item that provides a flat AC bonus. */
export interface ShieldItemDef {
	type: "shield";
	id: string;
	name: string;
	description?: string;
	acBonus: number;
}

/** Accessory item: ring or amulet that applies passive effects. */
export interface AccessoryItemDef {
	type: "accessory";
	id: string;
	name: string;
	description?: string;
	slot: "ring" | "amulet";
	/** Effects applied permanently when equipped — same descriptors as passive skills. */
	effects: PassiveSkillEffectDescriptor[];
}

export type ItemDef = WeaponItemDef | ArmorItemDef | ShieldItemDef | AccessoryItemDef;

/**
 * A creature's innate attack (bite, claws, slam, etc.).
 * Defined in NPC JSON. Used as the weapon when no item is equipped in mainHand.
 * Natural attacks are always treated as proficient.
 */
export interface NaturalWeapon {
	name: string;
	/** Dice expression for damage, e.g. "1d4". Consistent with skill JSON format. */
	damageDice: string;
	damageType: DamageType;
	/** Which ability modifier drives attack and damage rolls. */
	attackStat: "strength" | "dexterity";
}

/** Equipment slot assignments for an actor. All slots are optional. */
export interface EquipmentSlots {
	mainHand?: string;
	offHand?: string;
	head?: string;
	body?: string;
	hands?: string;
	feet?: string;
	ring1?: string;
	ring2?: string;
	amulet?: string;
}
