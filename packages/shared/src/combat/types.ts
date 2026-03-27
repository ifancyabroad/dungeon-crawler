import type { DamageType } from "../config/combat";

/** Combat result types. JSON-serializable for events and replay. */

export interface AttackResult {
	hit: boolean;
	critical: boolean;
	naturalRoll: number;
	totalAttackRoll: number;
	damage: number;
	/** Damage breakdown (after resistances/immunities) for multi-type attacks. */
	damagePackets: DamagePacket[];
	targetAc: number;
}

/** One damage packet represents a single damage type instance. */
export interface DamagePacket {
	damageType: DamageType;
	/** Pre-resistance amount (>= 0). */
	rawAmount: number;
	/** Post-resistance amount (>= 0). */
	effectiveAmount: number;
}

/** Weapon dice configuration for attack resolution. */
export interface WeaponDice {
	/** Dice expression, e.g. "1d8". Parsed by resolveAttack via parseDice(). */
	dice: string;
	/** Damage type this weapon deals. */
	damageType: DamageType;
}
