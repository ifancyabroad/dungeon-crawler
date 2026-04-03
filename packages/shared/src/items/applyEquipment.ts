/**
 * Apply equipped item effects to an actor.
 *
 * Called from the API layer after an actor is created and whenever the hero equips a new item
 * (pickup_item action). Pure function — returns a new actor, no mutation.
 *
 * On each call the following fields are fully recomputed (overwritten, not accumulated):
 *   itemAttackBonusFlat  — enhancement bonus + attack-roll affixes from the weapon
 *   itemAcBonus          — AC-modifier affixes from armor/shield slots
 *   armorClass           — base AC formula + shield + itemAcBonus
 *   equippedWeaponDice   — from mainHand weapon or naturalWeapon fallback
 *
 * Damage bonus arrays (passiveDamageBonuses / passiveFlatDamageBonuses) are also cleaned of
 * any previous item-sourced entries before new ones are pushed, so this function is safe to
 * call repeatedly without accumulating duplicates.
 */

import type { Actor } from "../game/types";
import type {
	AffixDef,
	ArmorItemDef,
	ItemDef,
	ItemInstance,
	ShieldItemDef,
	WeaponItemDef,
	AccessoryItemDef,
} from "./types";
import type { PassiveSkillEffectDescriptor } from "../skills/schemas";
import { abilityModifier } from "../combat/dice";

// ---------------------------------------------------------------------------
// Slot resolution
// ---------------------------------------------------------------------------

interface ResolvedSlot {
	baseDef: ItemDef;
	instance?: ItemInstance;
}

function resolveSlot(
	slotId: string | undefined,
	items: Record<string, ItemDef>,
	instances: Record<string, ItemInstance>,
): ResolvedSlot | null {
	if (!slotId) return null;
	const instance = instances[slotId];
	const baseId = instance ? instance.baseItemId : slotId;
	const baseDef = items[baseId];
	if (!baseDef) return null;
	return { baseDef, instance };
}

// ---------------------------------------------------------------------------
// buildEquipmentSlots
// ---------------------------------------------------------------------------

/** Build equipment slots from an ordered list of item IDs, using the first item of each type. */
export function buildEquipmentSlots(
	itemIds: string[],
	items: Record<string, ItemDef>,
): import("./types").EquipmentSlots {
	const slots: import("./types").EquipmentSlots = {};
	for (const id of itemIds) {
		const def = items[id];
		if (!def) continue;
		if (def.type === "weapon" && !slots.mainHand) {
			slots.mainHand = id;
		} else if (def.type === "shield" && !slots.offHand) {
			slots.offHand = id;
		} else if (def.type === "armor") {
			const armorSlot = def.slot;
			if (armorSlot === "body" && !slots.body) slots.body = id;
			else if (armorSlot === "head" && !slots.head) slots.head = id;
			else if (armorSlot === "hands" && !slots.hands) slots.hands = id;
			else if (armorSlot === "feet" && !slots.feet) slots.feet = id;
		} else if (def.type === "accessory") {
			if (def.slot === "ring") {
				if (!slots.ring1) slots.ring1 = id;
				else if (!slots.ring2) slots.ring2 = id;
			} else if (def.slot === "amulet" && !slots.amulet) {
				slots.amulet = id;
			}
		}
	}
	return slots;
}

// ---------------------------------------------------------------------------
// Affix application
// ---------------------------------------------------------------------------

/**
 * Apply a single affix effect to an actor. Returns a new actor.
 * Only handles the subset of effect types valid on affixes:
 *   add_damage_dice, add_flat_damage_bonus — stored in arrays with sourceItemInstanceId
 *   add_attack_roll_bonus                 — accumulated into itemAttackBonusFlat
 *   modify_armor_class                    — accumulated into itemAcBonus
 */
function applyAffix(actor: Actor, affix: AffixDef, instanceId: string): Actor {
	const effect = affix.effect;
	switch (effect.type) {
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
						requiredDamageType: effect.requiredDamageType,
						sourceItemInstanceId: instanceId,
					},
				],
			};
		case "add_flat_damage_bonus":
			return {
				...actor,
				passiveFlatDamageBonuses: [
					...actor.passiveFlatDamageBonuses,
					{
						amount: effect.amount,
						damageType: effect.damageType,
						appliesTo: effect.appliesTo,
						requiredDamageType: effect.requiredDamageType,
						sourceItemInstanceId: instanceId,
					},
				],
			};
		case "add_attack_roll_bonus":
			return { ...actor, itemAttackBonusFlat: actor.itemAttackBonusFlat + effect.amount };
		case "modify_armor_class":
			return { ...actor, itemAcBonus: actor.itemAcBonus + effect.amount };
		default:
			return actor;
	}
}

// ---------------------------------------------------------------------------
// Per-slot application helpers
// ---------------------------------------------------------------------------

function applyWeapon(actor: Actor, weapon: WeaponItemDef, instance?: ItemInstance): Actor {
	const proficient = actor.weaponProficiencies.includes(weapon.weaponCategory);
	const finesse = weapon.properties.includes("finesse");
	const effectiveDamageDice =
		weapon.versatileDice && !actor.equipment.offHand ? weapon.versatileDice : weapon.damageDice;

	return {
		...actor,
		equippedWeaponDice: { dice: effectiveDamageDice, damageType: weapon.damageType },
		equippedAttackStat: "strength" as const,
		equippedWeaponFinesse: finesse,
		weaponProficient: proficient,
		itemAttackBonusFlat: actor.itemAttackBonusFlat + (instance?.enhancementBonus ?? 0),
	};
}

function applyArmor(actor: Actor, armor: ArmorItemDef, instance?: ItemInstance): Actor {
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
	// Enhancement bonus applies to AC for armour.
	ac += instance?.enhancementBonus ?? 0;
	return { ...actor, armorClass: ac };
}

function applyShield(actor: Actor, shield: ShieldItemDef, instance?: ItemInstance): Actor {
	return {
		...actor,
		armorClass: actor.armorClass + shield.acBonus + (instance?.enhancementBonus ?? 0),
	};
}

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
						requiredDamageType: effect.requiredDamageType,
					},
				],
			};
		case "add_flat_damage_bonus":
			return {
				...actor,
				passiveFlatDamageBonuses: [
					...actor.passiveFlatDamageBonuses,
					{
						amount: effect.amount,
						damageType: effect.damageType,
						appliesTo: effect.appliesTo,
						requiredDamageType: effect.requiredDamageType,
					},
				],
			};
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

function applyAccessory(actor: Actor, accessory: AccessoryItemDef): Actor {
	let result = actor;
	for (const effect of accessory.effects) {
		result = applyAccessoryEffect(result, effect);
	}
	return result;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Apply all effects from the actor's equipped items.
 *
 * Items are resolved from `instances` (procedural drops) or directly from `items`
 * (static base-item IDs). Unknown IDs are silently ignored.
 *
 * Safe to call repeatedly — previous item-sourced array entries are stripped first.
 *
 * Weapon resolution priority:
 *   1. mainHand item weapon
 *   2. naturalWeapon (innate attack)
 *   3. UNARMED_WEAPON (engine's initial placeholder)
 */
export function applyEquipment(
	actor: Actor,
	items: Record<string, ItemDef>,
	instances: Record<string, ItemInstance> = {},
	affixesById: Record<string, AffixDef> = {},
): Actor {
	// Strip all previously applied item-affix array entries so re-equipping doesn't accumulate.
	let result: Actor = {
		...actor,
		itemAttackBonusFlat: 0,
		itemAcBonus: 0,
		passiveDamageBonuses: actor.passiveDamageBonuses.filter((b) => !b.sourceItemInstanceId),
		passiveFlatDamageBonuses: actor.passiveFlatDamageBonuses.filter(
			(b) => !b.sourceItemInstanceId,
		),
	};

	// --- Body armor sets the base armorClass ---
	const bodySlot = resolveSlot(result.equipment.body, items, instances);
	if (bodySlot?.baseDef.type === "armor") {
		result = applyArmor(result, bodySlot.baseDef, bodySlot.instance);
	}

	// --- Extremity armor slots (head, hands, feet) add AC on top ---
	for (const slotKey of ["head", "hands", "feet"] as const) {
		const resolved = resolveSlot(result.equipment[slotKey], items, instances);
		if (resolved?.baseDef.type === "armor") {
			const armorDef = resolved.baseDef;
			const dexMod = abilityModifier(result.attributes.dexterity);
			let slotAc: number;
			switch (armorDef.armorCategory) {
				case "cloth":
				case "light":
					slotAc = armorDef.baseAC + dexMod;
					break;
				case "medium":
					slotAc = armorDef.baseAC + Math.min(dexMod, 2);
					break;
				case "heavy":
					slotAc = armorDef.baseAC;
					break;
			}
			slotAc += resolved.instance?.enhancementBonus ?? 0;
			result = { ...result, armorClass: result.armorClass + slotAc };
		}
	}

	// --- Off-hand (shield) ---
	const offHandSlot = resolveSlot(result.equipment.offHand, items, instances);
	if (offHandSlot?.baseDef.type === "shield") {
		result = applyShield(result, offHandSlot.baseDef, offHandSlot.instance);
	}

	// --- Main-hand (weapon) ---
	const mainHandSlot = resolveSlot(result.equipment.mainHand, items, instances);
	if (mainHandSlot?.baseDef.type === "weapon") {
		result = applyWeapon(result, mainHandSlot.baseDef, mainHandSlot.instance);
		if (mainHandSlot.instance) {
			for (const affixId of mainHandSlot.instance.affixIds) {
				const affix = affixesById[affixId];
				if (affix) result = applyAffix(result, affix, mainHandSlot.instance.instanceId);
			}
		}
	} else if (actor.naturalWeapon) {
		const nw = actor.naturalWeapon;
		result = {
			...result,
			equippedWeaponDice: { dice: nw.damageDice, damageType: nw.damageType },
			equippedAttackStat: nw.attackStat,
			equippedWeaponFinesse: false,
			weaponProficient: true,
		};
	}

	// --- Armor affixes (body / head / hands / feet) ---
	for (const slotKey of ["body", "head", "hands", "feet"] as const) {
		const resolved = resolveSlot(result.equipment[slotKey], items, instances);
		if (resolved?.instance) {
			for (const affixId of resolved.instance.affixIds) {
				const affix = affixesById[affixId];
				if (affix) result = applyAffix(result, affix, resolved.instance.instanceId);
			}
		}
	}

	// --- Shield affixes ---
	if (offHandSlot?.instance) {
		for (const affixId of offHandSlot.instance.affixIds) {
			const affix = affixesById[affixId];
			if (affix) result = applyAffix(result, affix, offHandSlot.instance.instanceId);
		}
	}

	// Fold accumulated itemAcBonus into armorClass.
	result = { ...result, armorClass: result.armorClass + result.itemAcBonus };

	// --- Accessories (ring1, ring2, amulet) — base effects only, no affixes in this pass ---
	for (const slotKey of ["ring1", "ring2", "amulet"] as const) {
		const resolved = resolveSlot(result.equipment[slotKey], items, instances);
		if (resolved?.baseDef.type === "accessory") {
			result = applyAccessory(result, resolved.baseDef);
		}
	}

	return result;
}
