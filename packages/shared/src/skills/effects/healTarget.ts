/**
 * Heal target effect: restores HP to the targeted actor.
 *
 * Rolls the specified dice expression, adds an optional ability modifier,
 * and restores that much HP to the target (capped at their maxHp). Emits a
 * "healed" event for the client to display a green number.
 */

import type { FloorState, GameEvent } from "../../game/types";
import type { Actor } from "../../game/types";
import type { Rng } from "../../rng";
import type { HealTargetEffect } from "../types";
import { abilityModifier, rollDiceExpr } from "../../combat/dice";

export function applyHealTarget(
	effect: HealTargetEffect,
	caster: Actor,
	targetActorId: string,
	floorState: FloorState,
	rng: Rng,
	skillId: string,
): { floorState: FloorState; events: GameEvent[] } | { error: string } {
	const target = floorState.actorsById[targetActorId];
	if (!target || !target.alive) return { error: "heal_target_no_target" };

	const statMod =
		effect.scalingStat !== undefined
			? abilityModifier(caster.attributes[effect.scalingStat])
			: 0;

	const rawHeal = rollDiceExpr(rng, effect.dice);
	const healAmount = Math.max(0, rawHeal + statMod);
	const newHp = Math.min(target.hp + healAmount, target.maxHp);
	const actualHeal = newHp - target.hp;

	const events: GameEvent[] = [];
	if (actualHeal > 0) {
		events.push({ type: "healed", actorId: targetActorId, amount: actualHeal, skillId });
	}

	return {
		floorState: {
			...floorState,
			actorsById: { ...floorState.actorsById, [targetActorId]: { ...target, hp: newHp } },
		},
		events,
	};
}
