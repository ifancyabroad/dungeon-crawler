/**
 * Item type definitions. Used by both the engine (for Actor equipment fields)
 * and the content package (for JSON schema validation).
 *
 * Dice expressions (e.g. "1d8") are stored as strings — consistent with skill JSON.
 * The engine converts these to WeaponDice objects via parseDice() when applying equipment.
 */

import type { DamageType } from "../config/combat";
import type { PassiveSkillEffectDescriptor } from "../skills/schemas";

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

/** Armor item: body armor that occupies the armor slot. */
export interface ArmorItemDef {
	type: "armor";
	id: string;
	name: string;
	description?: string;
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
	armor?: string;
	ring?: string;
}
