/**
 * Apply a passive skill's effects permanently to the hero actor.
 * Called once when the hero selects a passive skill from the level-up offer,
 * and again when upgrading an existing passive to a higher rank.
 *
 * effectsByRank contains the FULL effects for each rank (not deltas).
 * When previousRank > 0, only the numeric delta between ranks is applied so
 * that effects already granted are not double-counted.
 *
 * Idempotent effects (resistances, immunities, proficiencies) are only ever
 * applied at the initial grant (previousRank === 0); they are the same at
 * every rank and cannot be meaningfully "upgraded".
 *
 * add_damage_dice and add_flat_damage_bonus replace the old rank's entry using sourceSkillId tracking.
 */

import type { Actor } from "../game/types";
import type { PassiveSkillDefinition, PassiveSkillEffectDescriptor } from "./types";

/**
 * Apply a single passive effect to the actor.
 * `delta` is the numeric difference between the new and previous rank value.
 * For non-numeric / idempotent effects `delta` is unused; pass 0.
 * `isFirstGrant` is true when the skill is being granted for the first time.
 */
function applyEffect(
	actor: Actor,
	effect: PassiveSkillEffectDescriptor,
	delta: number,
	isFirstGrant: boolean,
	skillId: string,
): Actor {
	switch (effect.type) {
		case "modify_attribute": {
			return {
				...actor,
				attributes: {
					...actor.attributes,
					[effect.attribute]: actor.attributes[effect.attribute] + delta,
				},
			};
		}

		case "modify_armor_class": {
			return { ...actor, armorClass: actor.armorClass + delta };
		}

		case "add_damage_resistance": {
			if (!isFirstGrant) return actor;
			if (actor.damageResistances.includes(effect.damageType)) return actor;
			return { ...actor, damageResistances: [...actor.damageResistances, effect.damageType] };
		}

		case "add_damage_immunity": {
			if (!isFirstGrant) return actor;
			if (actor.damageImmunities.includes(effect.damageType)) return actor;
			return { ...actor, damageImmunities: [...actor.damageImmunities, effect.damageType] };
		}

		case "add_damage_dice": {
			// Replace existing entry for this skill with the new rank's values
			const filtered = actor.passiveDamageBonuses.filter((b) => b.sourceSkillId !== skillId);
			return {
				...actor,
				passiveDamageBonuses: [
					...filtered,
					{
						dice: effect.dice,
						damageType: effect.damageType,
						appliesTo: effect.appliesTo,
						onCritOnly: effect.onCritOnly,
						sourceSkillId: skillId,
						requiredDamageType: effect.requiredDamageType,
					},
				],
			};
		}

		case "add_flat_damage_bonus": {
			// Replace existing entry for this skill with the new rank's values
			const filtered = actor.passiveFlatDamageBonuses.filter(
				(b) => b.sourceSkillId !== skillId,
			);
			return {
				...actor,
				passiveFlatDamageBonuses: [
					...filtered,
					{
						amount: effect.amount,
						damageType: effect.damageType,
						appliesTo: effect.appliesTo,
						sourceSkillId: skillId,
						requiredDamageType: effect.requiredDamageType,
					},
				],
			};
		}

		case "add_status_immunity": {
			if (!isFirstGrant) return actor;
			if (actor.statusImmunities.includes(effect.statusId)) return actor;
			return { ...actor, statusImmunities: [...actor.statusImmunities, effect.statusId] };
		}

		case "modify_max_hp": {
			return {
				...actor,
				maxHp: actor.maxHp + delta,
				hp: actor.hp + delta,
			};
		}

		case "modify_hit_die": {
			// Always overwrite — the new rank's die supersedes the old one
			return { ...actor, hitDie: effect.die };
		}

		case "add_saving_throw_proficiency": {
			if (!isFirstGrant) return actor;
			if (actor.savingThrowProficiencies.includes(effect.ability)) return actor;
			return {
				...actor,
				savingThrowProficiencies: [...actor.savingThrowProficiencies, effect.ability],
			};
		}

		case "add_attack_roll_bonus": {
			return { ...actor, attackBonusFlat: (actor.attackBonusFlat ?? 0) + delta };
		}

		case "modify_crit_threshold": {
			const current = actor.critThreshold ?? 20;
			return { ...actor, critThreshold: Math.max(1, current - delta) };
		}

		case "add_damage_vulnerability": {
			if (!isFirstGrant) return actor;
			if (actor.damageVulnerabilities.includes(effect.damageType)) return actor;
			return {
				...actor,
				damageVulnerabilities: [...actor.damageVulnerabilities, effect.damageType],
			};
		}

		case "add_healing_bonus_flat": {
			return { ...actor, healingBonusFlat: (actor.healingBonusFlat ?? 0) + delta };
		}

		case "add_dot_amplify_flat": {
			return { ...actor, dotAmplifyFlat: (actor.dotAmplifyFlat ?? 0) + delta };
		}

		default: {
			const _exhaustive: never = effect;
			void _exhaustive;
			return actor;
		}
	}
}

/** Extract the numeric "amount" field from an effect (0 for effects without one). */
function getAmount(effect: PassiveSkillEffectDescriptor): number {
	switch (effect.type) {
		case "modify_attribute":
		case "modify_armor_class":
		case "modify_max_hp":
		case "add_attack_roll_bonus":
		case "add_healing_bonus_flat":
		case "add_dot_amplify_flat":
			return effect.amount;
		case "modify_crit_threshold":
			return effect.reduction;
		default:
			return 0;
	}
}

/**
 * Apply a passive skill's effects to an actor, handling both first-grant and upgrades.
 *
 * @param actor - The actor to update.
 * @param skillDef - The passive skill definition (contains effectsByRank).
 * @param previousRank - The rank the hero previously held (0 = not yet owned).
 * @param newRank - The rank being granted now (1–3).
 */
export function applyPassiveSkill(
	actor: Actor,
	skillDef: PassiveSkillDefinition,
	previousRank: number,
	newRank: number,
): Actor {
	const newEffects = skillDef.effectsByRank[newRank - 1];
	const prevEffects = previousRank > 0 ? skillDef.effectsByRank[previousRank - 1] : undefined;
	const isFirstGrant = previousRank === 0;

	let result = actor;
	for (let i = 0; i < newEffects.length; i++) {
		const newEffect = newEffects[i]!;
		const prevEffect = prevEffects?.[i];

		const newAmount = getAmount(newEffect);
		const prevAmount = prevEffect ? getAmount(prevEffect) : 0;
		const delta = newAmount - prevAmount;

		result = applyEffect(result, newEffect, delta, isFirstGrant, skillDef.id);
	}
	return result;
}
