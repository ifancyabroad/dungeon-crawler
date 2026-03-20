/**
 * Data-driven registry of combat modifiers granted by status effects.
 *
 * To add a new status that modifies combat, add an entry here — no changes
 * to combat.ts or applyDamageToActor.ts are needed.
 */

import type { DamageType } from "./damageTypes";

/**
 * Flat bonus damage packets added to a melee attack when the attacker
 * has the specified status active.
 */
export const STATUS_MELEE_ATTACK_BONUSES: Partial<
	Record<string, { damageType: DamageType; flatAmount: number }>
> = {
	berserk: { damageType: "bludgeoning", flatAmount: 5 },
};

/**
 * Flat bonus damage added to every incoming hit when the defender
 * has the specified status active (trade-off / vulnerability).
 */
export const STATUS_INCOMING_DAMAGE_BONUSES: Partial<Record<string, number>> = {
	berserk: 2,
};
