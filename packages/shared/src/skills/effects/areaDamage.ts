/**
 * Area damage effect: deals damage to every living actor within radiusTiles of a target tile.
 * Dice expression is parsed (e.g. "2d6"), optionally scaled by a stat modifier.
 */

import type { Actor, FloorState, GameEvent } from "../../game/types";
import type { Rng } from "../../rng";
import type { AreaDamageEffect } from "../types";
import { abilityModifier, rollDiceExpr } from "../../combat/dice";
import { resolveDamagePackets } from "../../combat/resolveDamage";
import { idxToXY } from "../../game/engine";

/** Chebyshev distance (diagonal counts as 1). */
function chebyshevDistance(ax: number, ay: number, bx: number, by: number): number {
	return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

export function applyAreaDamage(
	effect: AreaDamageEffect,
	caster: Actor,
	targetTileIdx: number,
	floorState: FloorState,
	width: number,
	rng: Rng,
	skillId: string,
): { floorState: FloorState; events: GameEvent[] } {
	const { x: tx, y: ty } = idxToXY(targetTileIdx, width);
	const events: GameEvent[] = [];

	const statMod =
		effect.scalingStat !== undefined
			? abilityModifier(caster.attributes[effect.scalingStat])
			: 0;

	let actorsById = { ...floorState.actorsById };

	for (const [id, actor] of Object.entries(actorsById)) {
		if (!actor.alive || id === caster.id) continue;

		const { x: ax, y: ay } = idxToXY(actor.idx, width);
		if (chebyshevDistance(ax, ay, tx, ty) > effect.radiusTiles) continue;

		const rawDamage = rollDiceExpr(rng, effect.dice);
		const rawAmount = Math.max(0, rawDamage + statMod);

		const resolved = resolveDamagePackets(
			[
				{
					damageType: effect.damageType,
					rawAmount,
					// resolveDamagePackets overwrites effectiveAmount.
					effectiveAmount: 0,
				},
			],
			actor,
		);

		const effectiveDamage = resolved.totalEffectiveDamage;
		const newHp = Math.max(0, actor.hp - effectiveDamage);
		const updatedActor: Actor = { ...actor, hp: newHp, alive: newHp > 0 };
		actorsById = { ...actorsById, [id]: updatedActor };

		events.push({
			type: "area_hit",
			attackerId: caster.id,
			defenderId: id,
			damage: effectiveDamage,
			damagePackets: resolved.packets,
			skillId,
		});

		if (!updatedActor.alive) {
			events.push({ type: "death", actorId: id });
		}
	}

	return { floorState: { ...floorState, actorsById }, events };
}
