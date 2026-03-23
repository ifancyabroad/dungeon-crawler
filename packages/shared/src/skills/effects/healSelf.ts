/**
 * Heal self effect: restores HP to the caster.
 *
 * Rolls the specified dice expression, adds an optional ability modifier,
 * and restores that much HP (capped at maxHp). Emits a "healed" event for
 * the client to display a green number.
 */

import type { Actor, GameEvent } from "../../game/types";
import type { Rng } from "../../rng";
import type { HealSelfEffect } from "../types";
import { abilityModifier, rollDiceExpr } from "../../combat/dice";

export function applyHealSelf(
	effect: HealSelfEffect,
	caster: Actor,
	rng: Rng,
	skillId: string,
): { caster: Actor; events: GameEvent[] } {
	const statMod =
		effect.scalingStat !== undefined
			? abilityModifier(caster.attributes[effect.scalingStat])
			: 0;

	const rawHeal = rollDiceExpr(rng, effect.dice);
	const healAmount = Math.max(0, rawHeal + statMod);
	const newHp = Math.min(caster.hp + healAmount, caster.maxHp);
	const actualHeal = newHp - caster.hp;

	const updatedCaster: Actor = { ...caster, hp: newHp };
	const events: GameEvent[] = [];

	if (actualHeal > 0) {
		events.push({ type: "healed", actorId: caster.id, amount: actualHeal, skillId });
	}

	return { caster: updatedCaster, events };
}
