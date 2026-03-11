/**
 * Attack resolution. Pure function — does not mutate actors.
 * Returns an AttackResult describing what happened so the caller can apply state changes.
 */

import type { Rng } from "../rng";
import type { Actor } from "../game/types";
import type { AttackResult, WeaponDice } from "./types";
import { UNARMED_WEAPON } from "./types";
import { rollD20, rollDice, abilityModifier } from "./dice";

/**
 * Resolve a melee attack from attacker against defender.
 *
 * - Attack roll: D20 + STR modifier vs defender AC.
 * - Natural 20: always hits + critical (double damage dice).
 * - Damage: weapon dice + STR modifier (minimum 0 total).
 * - Critical: roll weapon dice twice, then add modifier once.
 */
export function resolveAttack(
	attacker: Actor,
	defender: Actor,
	rng: Rng,
	weapon: WeaponDice = UNARMED_WEAPON,
): AttackResult {
	const strMod = abilityModifier(attacker.attributes.strength);
	const naturalRoll = rollD20(rng);
	const totalAttackRoll = naturalRoll + strMod;
	const targetAc = defender.armorClass;
	const critical = naturalRoll === 20;
	const hit = critical || totalAttackRoll >= targetAc;

	let damage = 0;
	if (hit) {
		const diceCount = (weapon.count ?? 1) * (critical ? 2 : 1);
		let diceTotal = 0;
		for (let i = 0; i < diceCount; i++) {
			diceTotal += rollDice(rng, weapon.sides);
		}
		damage = Math.max(0, diceTotal + strMod);
	}

	return { hit, critical, naturalRoll, totalAttackRoll, damage, targetAc };
}
