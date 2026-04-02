/**
 * Collect all active-effect damage packets (flat + dice) for an attack.
 *
 * Reads CombatAdjustments stored on each active effect and emits DamagePackets
 * for the given attack mode. Returns raw packets with effectiveAmount: 0 —
 * callers must still pass results through resolveDamagePackets.
 *
 * @param actor               The attacking actor.
 * @param rng                 RNG for dice rolls (flat bonuses do not consume RNG).
 * @param attackMode          Category to match: "melee", "ranged", or "area".
 * @param fallbackDamageType  Damage type used for dice-bonus packets (the skill or
 *                            weapon's primary type, since dice bonuses inherit it).
 */

import type { Actor } from "../game/types";
import type { DamageType } from "../config/combat";
import type { DamagePacket } from "./types";
import type { Rng } from "../rng";
import { rollDiceExpr } from "./dice";

export function collectActiveEffectDamagePackets(
	actor: Actor,
	rng: Rng,
	attackMode: "melee" | "ranged" | "area",
	fallbackDamageType: DamageType,
): DamagePacket[] {
	const packets: DamagePacket[] = [];

	const flatKey =
		attackMode === "melee"
			? "meleeDamageFlat"
			: attackMode === "ranged"
				? "rangedDamageFlat"
				: "areaDamageFlat";

	const diceKey =
		attackMode === "melee"
			? "meleeDamageDiceBonus"
			: attackMode === "ranged"
				? "rangedDamageDiceBonus"
				: "areaDamageDiceBonus";

	for (const eff of actor.activeEffects) {
		if (eff.remainingTurns <= 0) continue;
		const adj = eff.adjustments?.[flatKey];
		if (adj) {
			packets.push({
				damageType: adj.damageType,
				rawAmount: adj.amount,
				effectiveAmount: 0,
			});
		}
		const diceBonusExpr = eff.adjustments?.[diceKey];
		if (diceBonusExpr) {
			packets.push({
				damageType: fallbackDamageType,
				rawAmount: rollDiceExpr(rng, diceBonusExpr),
				effectiveAmount: 0,
			});
		}
	}

	return packets;
}
