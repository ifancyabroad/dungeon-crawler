/**
 * Apply a passive skill's effects permanently to the hero actor.
 * Called once when the hero selects a passive skill from the level-up offer.
 *
 * "Apply-on-acquire" effects (modify_attribute, modify_armor_class,
 * add_damage_resistance, add_damage_immunity) mutate existing Actor fields
 * directly — no new fields required.
 *
 * "Read-at-resolution" effects (add_damage_dice, add_status_immunity) push
 * structured data onto new Actor fields consulted during combat resolution.
 */

import type { Actor } from "../game/types";
import type { PassiveSkillDefinition, PassiveSkillEffectDescriptor } from "./types";

function applyEffect(actor: Actor, effect: PassiveSkillEffectDescriptor): Actor {
	switch (effect.type) {
		case "modify_attribute": {
			return {
				...actor,
				attributes: {
					...actor.attributes,
					[effect.attribute]: actor.attributes[effect.attribute] + effect.amount,
				},
			};
		}

		case "modify_armor_class": {
			return { ...actor, armorClass: actor.armorClass + effect.amount };
		}

		case "add_damage_resistance": {
			if (actor.damageResistances.includes(effect.damageType)) return actor;
			return { ...actor, damageResistances: [...actor.damageResistances, effect.damageType] };
		}

		case "add_damage_immunity": {
			if (actor.damageImmunities.includes(effect.damageType)) return actor;
			return { ...actor, damageImmunities: [...actor.damageImmunities, effect.damageType] };
		}

		case "add_damage_dice": {
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
		}

		case "add_status_immunity": {
			if (actor.statusImmunities.includes(effect.statusId)) return actor;
			return { ...actor, statusImmunities: [...actor.statusImmunities, effect.statusId] };
		}

		default: {
			const _exhaustive: never = effect;
			void _exhaustive;
			return actor;
		}
	}
}

/** Apply all effects from a passive skill definition onto the actor. Pure function. */
export function applyPassiveSkill(actor: Actor, skillDef: PassiveSkillDefinition): Actor {
	let result = actor;
	for (const effect of skillDef.effects) {
		result = applyEffect(result, effect);
	}
	return result;
}
