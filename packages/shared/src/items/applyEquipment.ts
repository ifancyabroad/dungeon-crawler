/**
 * Apply equipped item effects to an actor.
 *
 * Called from the API layer after an actor is created (same pattern as applyPassiveSkill
 * for NPCs in npcSpawning.service.ts). Pure function — returns a new actor, no mutation.
 *
 * Resolves:
 *   - Weapon (mainHand): sets equippedWeaponDice, weaponProficient, equippedWeaponFinesse
 *   - Armor: computes AC using 5E formulas (cloth/light = base+DEX, medium = base+DEX max+2, heavy = fixed)
 *   - Shield (offHand): adds acBonus to armorClass
 *   - Accessory (ring): applies PassiveSkillEffectDescriptor effects
 */

import type { Actor } from "../game/types";
import type {
	ItemDef,
	WeaponItemDef,
	ArmorItemDef,
	ShieldItemDef,
	AccessoryItemDef,
} from "./types";
import type { PassiveSkillEffectDescriptor } from "../skills/schemas";
import { abilityModifier } from "../combat/dice";

/** Build equipment slots from an ordered list of item IDs, using the first item of each type. */
export function buildEquipmentSlots(
	itemIds: string[],
	items: Record<string, ItemDef>,
): import("./types").EquipmentSlots {
	const slots: import("./types").EquipmentSlots = {};
	for (const id of itemIds) {
		const def = items[id];
		if (!def) continue;
		if (def.type === "weapon" && !slots.mainHand) slots.mainHand = id;
		else if (def.type === "shield" && !slots.offHand) slots.offHand = id;
		else if (def.type === "armor" && !slots.armor) slots.armor = id;
		else if (def.type === "accessory" && !slots.ring) slots.ring = id;
	}
	return slots;
}

/** Apply a single accessory effect descriptor to an actor. */
function applyAccessoryEffect(actor: Actor, effect: PassiveSkillEffectDescriptor): Actor {
	switch (effect.type) {
		case "modify_attribute":
			return {
				...actor,
				attributes: {
					...actor.attributes,
					[effect.attribute]: actor.attributes[effect.attribute] + effect.amount,
				},
			};
		case "modify_armor_class":
			return { ...actor, armorClass: actor.armorClass + effect.amount };
		case "modify_max_hp":
			return { ...actor, maxHp: actor.maxHp + effect.amount, hp: actor.hp + effect.amount };
		case "add_damage_resistance":
			if (actor.damageResistances.includes(effect.damageType)) return actor;
			return { ...actor, damageResistances: [...actor.damageResistances, effect.damageType] };
		case "add_damage_immunity":
			if (actor.damageImmunities.includes(effect.damageType)) return actor;
			return { ...actor, damageImmunities: [...actor.damageImmunities, effect.damageType] };
		case "add_attack_roll_bonus":
			return { ...actor, attackBonusFlat: (actor.attackBonusFlat ?? 0) + effect.amount };
		case "add_saving_throw_proficiency":
			if (actor.savingThrowProficiencies.includes(effect.ability)) return actor;
			return {
				...actor,
				savingThrowProficiencies: [...actor.savingThrowProficiencies, effect.ability],
			};
		case "add_status_immunity":
			if (actor.statusImmunities.includes(effect.statusId)) return actor;
			return { ...actor, statusImmunities: [...actor.statusImmunities, effect.statusId] };
		case "add_damage_dice":
			return {
				...actor,
				passiveDamageBonuses: [
					...actor.passiveDamageBonuses,
					{
						dice: effect.dice,
						damageType: effect.damageType,
						appliesTo: effect.appliesTo,
						onCritOnly: effect.onCritOnly,
					},
				],
			};
		// These are not meaningful for accessories; skip silently.
		case "modify_hit_die":
		case "modify_crit_threshold":
		case "add_damage_vulnerability":
		case "add_healing_bonus_flat":
		case "add_dot_amplify_flat":
			return actor;
		default: {
			const _exhaustive: never = effect;
			void _exhaustive;
			return actor;
		}
	}
}

function applyWeapon(actor: Actor, weapon: WeaponItemDef): Actor {
	const proficient = actor.weaponProficiencies.includes(weapon.weaponCategory);
	const finesse = weapon.properties.includes("finesse");
	// Versatile: use two-handed dice when off-hand slot is empty
	const effectiveDamageDice =
		weapon.versatileDice && !actor.equipment.offHand ? weapon.versatileDice : weapon.damageDice;

	return {
		...actor,
		equippedWeaponDice: { dice: effectiveDamageDice, damageType: weapon.damageType },
		equippedAttackStat: "strength" as const,
		equippedWeaponFinesse: finesse,
		weaponProficient: proficient,
	};
}

function applyArmor(actor: Actor, armor: ArmorItemDef): Actor {
	const dexMod = abilityModifier(actor.attributes.dexterity);
	let ac: number;
	switch (armor.armorCategory) {
		case "cloth":
		case "light":
			ac = armor.baseAC + dexMod;
			break;
		case "medium":
			ac = armor.baseAC + Math.min(dexMod, 2);
			break;
		case "heavy":
			ac = armor.baseAC;
			break;
	}
	return { ...actor, armorClass: ac };
}

function applyShield(actor: Actor, shield: ShieldItemDef): Actor {
	return { ...actor, armorClass: actor.armorClass + shield.acBonus };
}

function applyAccessory(actor: Actor, accessory: AccessoryItemDef): Actor {
	let result = actor;
	for (const effect of accessory.effects) {
		result = applyAccessoryEffect(result, effect);
	}
	return result;
}

/**
 * Apply all effects from the actor's equipped items.
 * Items are looked up by ID from `actor.equipment`.
 * Unknown item IDs are silently ignored.
 *
 * Weapon resolution priority (highest to lowest):
 *   1. mainHand item weapon
 *   2. naturalWeapon (innate attack — beasts, monsters, etc.)
 *   3. UNARMED_WEAPON (the engine's initial placeholder)
 */
export function applyEquipment(actor: Actor, items: Record<string, ItemDef>): Actor {
	let result = actor;

	if (actor.equipment.armor) {
		const def = items[actor.equipment.armor];
		if (def?.type === "armor") result = applyArmor(result, def);
	}

	if (actor.equipment.offHand) {
		const def = items[actor.equipment.offHand];
		if (def?.type === "shield") result = applyShield(result, def);
	}

	if (actor.equipment.mainHand) {
		const def = items[actor.equipment.mainHand];
		if (def?.type === "weapon") result = applyWeapon(result, def);
	} else if (actor.naturalWeapon) {
		const nw = actor.naturalWeapon;
		result = {
			...result,
			equippedWeaponDice: { dice: nw.damageDice, damageType: nw.damageType },
			equippedAttackStat: nw.attackStat,
			equippedWeaponFinesse: false,
			// Natural attacks are always treated as proficient.
			weaponProficient: true,
		};
	}

	if (actor.equipment.ring) {
		const def = items[actor.equipment.ring];
		if (def?.type === "accessory") result = applyAccessory(result, def);
	}

	return result;
}
