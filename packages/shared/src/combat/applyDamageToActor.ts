/**
 * Central damage-application helper.
 *
 * All code paths that reduce an actor's HP should call this instead of
 * computing `Math.max(0, hp - damage)` inline. It enforces two mechanics:
 *
 * 1. Shield absorption — incoming damage drains `shieldHp` first.
 * 2. Status-driven incoming damage adjustments (e.g. berserk vulnerability) —
 *    read from `effect.adjustments.incomingDamageFlat` on each active effect
 *    (data-driven; defined in the skill JSON).
 *
 * The function is pure and deterministic. It does NOT emit events; callers are
 * responsible for emitting `shield_absorbed` and adjusting `alive` / `death`.
 */

import type { Actor, GameEvent } from "../game/types";

export interface DamageApplicationResult {
	updatedActor: Actor;
	/** How much damage was absorbed by the shield (0 if no shield). */
	shieldAbsorbed: number;
	/** How much damage actually reached HP. */
	hpDamage: number;
	/** Convenience events: shield_absorbed (when > 0) and death (when hp reaches 0). */
	events: GameEvent[];
}

/**
 * Apply `effectiveDamage` to `actor`, respecting shield HP and berserk penalty.
 *
 * @param actor         - The actor receiving damage (not mutated).
 * @param effectiveDamage - Post-resistance/immunity damage amount (>= 0).
 * @returns A result containing the updated actor and emitted events.
 */
export function applyDamageToActor(actor: Actor, effectiveDamage: number): DamageApplicationResult {
	const events: GameEvent[] = [];

	// Data-driven incoming damage adjustments from active effects (e.g. berserk vulnerability).
	// Adjustments are defined in the skill JSON and copied onto the ActiveEffect at application time.
	let incomingAdjustment = 0;
	for (const effect of actor.activeEffects) {
		if (effect.remainingTurns > 0) {
			incomingAdjustment += effect.adjustments?.incomingDamageFlat ?? 0;
		}
	}
	const totalDamage = effectiveDamage + incomingAdjustment;

	// Shield absorbs before HP.
	const shieldHp = actor.numericBuffs["shieldHp"] ?? 0;
	const shieldAbsorbed = Math.min(shieldHp, totalDamage);
	const hpDamage = totalDamage - shieldAbsorbed;
	const newShield = shieldHp - shieldAbsorbed;
	const newHp = Math.max(0, actor.hp - hpDamage);

	if (shieldAbsorbed > 0) {
		events.push({
			type: "shield_absorbed",
			actorId: actor.id,
			absorbed: shieldAbsorbed,
			shieldHpRemaining: newShield,
		});
	}

	const updatedActor: Actor = {
		...actor,
		hp: newHp,
		numericBuffs: { ...actor.numericBuffs, shieldHp: newShield },
		alive: newHp > 0,
	};

	return { updatedActor, shieldAbsorbed, hpDamage, events };
}
