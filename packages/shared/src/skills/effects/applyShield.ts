/**
 * Apply shield effect: grants shield HP to the caster.
 * Incoming damage drains shieldHp before reducing actual HP.
 * Stacks additively with any existing shieldHp (so re-casting refreshes/tops up).
 */

import type { Actor, GameEvent } from "../../game/types";
import type { ApplyShieldEffect } from "../types";

export function applyShieldEffect(
	effect: ApplyShieldEffect,
	caster: Actor,
): { caster: Actor; events: GameEvent[] } {
	// Non-stackable: re-casting always resets shield to full, not added on top.
	const newShield = effect.amount;

	const updatedCaster: Actor = {
		...caster,
		numericBuffs: { ...caster.numericBuffs, shieldHp: newShield },
	};

	// shield_absorbed events are emitted by applyDamageToActor when damage is absorbed.
	// No status_applied needed here — the skill_used event already covers the log entry.
	const events: GameEvent[] = [];

	return { caster: updatedCaster, events };
}
