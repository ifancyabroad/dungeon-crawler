/**
 * Collect all passive bonus damage packets (dice + flat) for an attack.
 *
 * Returns raw packets with effectiveAmount: 0 — callers must still pass
 * results through resolveDamagePackets for resistance/immunity/vulnerability.
 *
 * @param actor                  The attacking actor.
 * @param rng                    RNG for dice rolls (flat bonuses do not consume RNG).
 * @param attackCategory         The attack category of the current effect. Matched against bonus.appliesTo.
 * @param isCritical             True when the attack is a critical hit.
 * @param applyOnCritMultiplier  True for melee/ranged (doubles onCritOnly dice). False for area.
 * @param primaryDamageType      Primary damage type of the attack — synergy filter for both types.
 */

import type { Actor } from "../game/types";
import type { AttackCategory, DamageType } from "../config/combat";
import type { DamagePacket } from "./types";
import type { Rng } from "../rng";
import { rollDiceExpr } from "./dice";

export function collectPassiveBonusPackets(
	actor: Actor,
	rng: Rng,
	attackCategory: AttackCategory,
	isCritical: boolean,
	applyOnCritMultiplier: boolean,
	primaryDamageType: DamageType,
): DamagePacket[] {
	const packets: DamagePacket[] = [];

	for (const bonus of actor.passiveDamageBonuses) {
		if (bonus.appliesTo !== "any" && bonus.appliesTo !== attackCategory) continue;
		if (bonus.onCritOnly && !isCritical) continue;
		if (
			bonus.requiredDamageType !== undefined &&
			bonus.requiredDamageType !== primaryDamageType
		)
			continue;
		const critMult = applyOnCritMultiplier && bonus.onCritOnly && isCritical ? 2 : 1;
		packets.push({
			damageType: bonus.damageType,
			rawAmount: rollDiceExpr(rng, bonus.dice, critMult),
			effectiveAmount: 0,
		});
	}

	for (const bonus of actor.passiveFlatDamageBonuses) {
		if (bonus.appliesTo !== "any" && bonus.appliesTo !== attackCategory) continue;
		if (
			bonus.requiredDamageType !== undefined &&
			bonus.requiredDamageType !== primaryDamageType
		)
			continue;
		packets.push({
			damageType: bonus.damageType,
			rawAmount: bonus.amount,
			effectiveAmount: 0,
		});
	}

	return packets;
}
