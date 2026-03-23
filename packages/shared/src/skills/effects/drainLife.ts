/**
 * Drain life effect: deals damage to the target and heals the caster independently.
 *
 * The damage roll and the heal roll are separate dice expressions, allowing
 * asymmetric drains (e.g. drain 2d6 necrotic, heal 1d6). Both rolls use the
 * game RNG so the outcome is fully deterministic and replayable.
 *
 * Damage is routed through applyDamageToActor (respects shield + adjustments).
 * Healing is capped at the caster's maxHp.
 */

import type { Actor, FloorState, GameEvent } from "../../game/types";
import type { Rng } from "../../rng";
import type { DrainLifeEffect } from "../types";
import { rollDiceExpr } from "../../combat/dice";
import { resolveDamagePackets } from "../../combat/resolveDamage";
import { applyDamageToActor } from "../../combat/applyDamageToActor";

export function applyDrainLife(
	effect: DrainLifeEffect,
	caster: Actor,
	targetActorId: string,
	floorState: FloorState,
	rng: Rng,
	skillId: string,
): { floorState: FloorState; caster: Actor; events: GameEvent[] } | { error: string } {
	const target = floorState.actorsById[targetActorId];
	if (!target || !target.alive) return { error: "drain_life_no_target" };

	const events: GameEvent[] = [];

	// --- Damage phase ---
	const rawDamage = rollDiceExpr(rng, effect.dice);
	const rawPackets: Parameters<typeof resolveDamagePackets>[0] = [
		{ damageType: effect.damageType, rawAmount: rawDamage, effectiveAmount: 0 },
	];
	const resolved = resolveDamagePackets(rawPackets, target);
	const effectiveDamage = resolved.totalEffectiveDamage;

	events.push({
		type: "area_hit",
		attackerId: caster.id,
		defenderId: targetActorId,
		damage: effectiveDamage,
		damagePackets: resolved.packets,
		skillId,
	});

	const { updatedActor: updatedTarget, events: damageEvents } = applyDamageToActor(
		target,
		effectiveDamage,
	);
	events.push(...damageEvents);
	if (!updatedTarget.alive) {
		events.push({ type: "death", actorId: targetActorId });
	}

	// --- Heal phase (independent dice roll) ---
	const rawHeal = rollDiceExpr(rng, effect.healDice);
	const healAmount = Math.max(0, rawHeal);
	const newCasterHp = Math.min(caster.hp + healAmount, caster.maxHp);
	const actualHeal = newCasterHp - caster.hp;
	const updatedCaster: Actor = { ...caster, hp: newCasterHp };

	if (actualHeal > 0) {
		events.push({ type: "healed", actorId: caster.id, amount: actualHeal, skillId });
	}

	return {
		floorState: {
			...floorState,
			actorsById: {
				...floorState.actorsById,
				[targetActorId]: updatedTarget,
				[caster.id]: updatedCaster,
			},
		},
		caster: updatedCaster,
		events,
	};
}
