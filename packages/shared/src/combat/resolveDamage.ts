import type { Actor } from "../game/types";
import type { DamagePacket } from "./types";
import { COMBAT_CONFIG } from "../config";

/**
 * Resolve a set of damage packets against defender resistances/immunities.
 * Pure + deterministic: no RNG, no environment reads.
 */
export function resolveDamagePackets(
	packets: DamagePacket[],
	defender: Actor,
): { packets: DamagePacket[]; totalEffectiveDamage: number } {
	const immunity = new Set(defender.damageImmunities);
	const resistance = new Set(defender.damageResistances);
	const vulnerability = new Set(defender.damageVulnerabilities);

	const resolvedPackets = packets.map((p) => {
		const raw = Math.max(0, p.rawAmount);

		let effectiveAmount = raw;
		if (immunity.has(p.damageType)) effectiveAmount = 0;
		else if (resistance.has(p.damageType))
			effectiveAmount = Math.floor(raw / COMBAT_CONFIG.rules.resistanceDivisor);
		else if (vulnerability.has(p.damageType))
			effectiveAmount = Math.floor(raw * COMBAT_CONFIG.rules.resistanceDivisor);

		return { ...p, rawAmount: raw, effectiveAmount };
	});

	const totalEffectiveDamage = resolvedPackets.reduce((sum, p) => sum + p.effectiveAmount, 0);
	return { packets: resolvedPackets, totalEffectiveDamage };
}
