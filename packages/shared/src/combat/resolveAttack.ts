/**
 * Attack resolution. Pure function — does not mutate actors.
 * Returns an AttackResult describing what happened so the caller can apply state changes.
 */

import type { Rng } from "../rng";
import type { Actor } from "../game/types";
import type { AttackResult, WeaponDice } from "./types";
import { rollD20Adjusted, rollDice, rollDiceExpr, parseDice } from "./dice";
import { resolveDamagePackets } from "./resolveDamage";
import { collectPassiveBonusPackets } from "./collectPassiveBonusPackets";
import { collectActiveEffectDamagePackets } from "./collectActiveEffectDamagePackets";

/**
 * Resolve a melee attack from attacker against defender.
 *
 * - Attack roll: D20 + attackMod + proficiencyBonus vs defender AC.
 * - Natural 20: always hits + critical (double damage dice).
 * - Damage: weapon dice + attackMod (minimum 0 total).
 * - Critical: roll weapon dice twice, then add modifier once.
 * - Passive bonuses: extra damage packets from attacker.passiveDamageBonuses
 *   that apply to "melee" or "any". onCritOnly bonuses only fire on a critical.
 * - Status adjustments: flat damage packets from `effect.adjustments.meleeDamageFlat`
 *   on each active effect (data-driven; defined in the skill JSON).
 *
 * @param weapon - Weapon dice to roll. Use actor.equippedWeaponDice (or UNARMED_WEAPON if unarmed).
 * @param attackMod - Ability modifier for attack and damage rolls (STR, or DEX for finesse/natural attacks).
 * @param proficiencyBonus - Proficiency bonus added to the attack roll. 0 if unproficient.
 */
export function resolveAttack(
	attacker: Actor,
	defender: Actor,
	rng: Rng,
	weapon: WeaponDice,
	attackMod: number,
	proficiencyBonus: number,
): AttackResult {
	// Advantage / disadvantage from active status effects (e.g. reckless_attack, frightened).
	let netAdvantage = false;
	let netDisadvantage = false;
	for (const eff of attacker.activeEffects) {
		if (eff.remainingTurns <= 0) continue;
		if (eff.adjustments?.hasAdvantage) netAdvantage = true;
		if (eff.adjustments?.hasDisadvantage) netDisadvantage = true;
	}
	const naturalRoll = rollD20Adjusted(rng, netAdvantage, netDisadvantage);

	// Flat attack roll bonus from passive skills (e.g. add_attack_roll_bonus).
	const flatBonus = attacker.attackBonusFlat ?? 0;

	// Dice bonuses/penalties from active status effects (e.g. bless, bane).
	let diceBonusTotal = 0;
	for (const effect of attacker.activeEffects) {
		if (effect.remainingTurns <= 0) continue;
		if (effect.adjustments?.attackRollDiceBonus) {
			diceBonusTotal += rollDiceExpr(rng, effect.adjustments.attackRollDiceBonus);
		}
		if (effect.adjustments?.attackRollDicePenalty) {
			diceBonusTotal -= rollDiceExpr(rng, effect.adjustments.attackRollDicePenalty);
		}
	}

	const totalAttackRoll = naturalRoll + attackMod + flatBonus + proficiencyBonus + diceBonusTotal;

	// AC adjustments from defender's active effects (e.g. shield of faith, cursed).
	let acAdjustment = 0;
	for (const effect of defender.activeEffects) {
		if (effect.remainingTurns <= 0) continue;
		acAdjustment += effect.adjustments?.acBonus ?? 0;
	}
	const targetAc = defender.armorClass + acAdjustment;

	// Crit threshold from passive skills (e.g. modify_crit_threshold).
	// Active effects can further reduce it temporarily (e.g. critThresholdReduction).
	let critThreshold = attacker.critThreshold ?? 20;
	for (const eff of attacker.activeEffects) {
		if (eff.remainingTurns <= 0) continue;
		critThreshold -= eff.adjustments?.critThresholdReduction ?? 0;
	}
	critThreshold = Math.max(1, critThreshold);
	const critical = naturalRoll >= critThreshold;
	const hit = critical || totalAttackRoll >= targetAc;

	let damage = 0;
	let damagePackets: AttackResult["damagePackets"] = [];
	if (hit) {
		const { count, sides } = parseDice(weapon.dice);
		const diceCount = count * (critical ? 2 : 1);
		let diceTotal = 0;
		for (let i = 0; i < diceCount; i++) {
			diceTotal += rollDice(rng, sides);
		}
		const rawWeaponAmount = Math.max(0, diceTotal + attackMod);

		const rawPackets: Parameters<typeof resolveDamagePackets>[0] = [
			{
				damageType: weapon.damageType,
				rawAmount: rawWeaponAmount,
				effectiveAmount: 0,
			},
		];

		// Apply passive damage bonuses from the attacker
		rawPackets.push(
			...collectPassiveBonusPackets(
				attacker,
				rng,
				"melee",
				critical,
				true,
				weapon.damageType,
			),
		);

		// Data-driven melee damage adjustments from active effects (e.g. berserk).
		// Adjustments are defined in the skill JSON and copied onto the ActiveEffect
		// at application time — no registry lookup needed.
		rawPackets.push(
			...collectActiveEffectDamagePackets(attacker, rng, "melee", weapon.damageType),
		);

		const resolved = resolveDamagePackets(rawPackets, defender);
		damage = resolved.totalEffectiveDamage;
		damagePackets = resolved.packets;
	}

	return { hit, critical, naturalRoll, totalAttackRoll, damage, damagePackets, targetAc };
}
