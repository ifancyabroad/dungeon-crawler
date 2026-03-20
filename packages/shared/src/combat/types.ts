import type { DamageType } from "./damageTypes";

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
	/** Number of sides on the damage die (e.g. 4 for D4, 6 for D6). */
	sides: number;
	/** Number of dice to roll (default 1). */
	count?: number;
	/** Damage type this weapon deals. */
	damageType: DamageType;
}

/** Default unarmed weapon: 1d4. */
export const UNARMED_WEAPON: WeaponDice = { sides: 4, count: 1, damageType: "bludgeoning" };
