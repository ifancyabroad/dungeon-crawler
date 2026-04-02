/**
 * Leap attack effect: teleports the caster to a target tile (any walkable tile within
 * Chebyshev range — no clear path required), then deals AoE damage to all actors
 * within `landingRadiusTiles` of the landing tile.
 *
 * The caster is excluded from AoE damage. Wall tiles (opacityMask === 1) and
 * occupied tiles (another living actor already there) are rejected as landing spots.
 */

import type { Actor, FloorState, GameEvent } from "../../game/types";
import type { Rng } from "../../rng";
import type { LeapAttackEffect } from "../types";
import { abilityModifier, rollDiceExpr } from "../../combat/dice";
import { resolveDamagePackets } from "../../combat/resolveDamage";
import { collectPassiveBonusPackets } from "../../combat/collectPassiveBonusPackets";
import { collectActiveEffectDamagePackets } from "../../combat/collectActiveEffectDamagePackets";
import { applyDamageToActor } from "../../combat/applyDamageToActor";
import { idxToXY } from "../../game/engineUtils";

function chebyshevDistance(ax: number, ay: number, bx: number, by: number): number {
	return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

export function applyLeapAttack(
	effect: LeapAttackEffect,
	caster: Actor,
	targetTileIdx: number,
	floorState: FloorState,
	width: number,
	height: number,
	rng: Rng,
	skillId: string,
	opacityMask?: Uint8Array,
): { floorState: FloorState; caster: Actor; events: GameEvent[] } | { error: string } {
	const { x: cx, y: cy } = idxToXY(caster.idx, width);
	const { x: tx, y: ty } = idxToXY(targetTileIdx, width);

	// Validate range (Chebyshev — diagonal leaps are allowed).
	const dist = chebyshevDistance(cx, cy, tx, ty);
	if (dist === 0) return { error: "leap_same_tile" };
	if (dist > effect.maxRangeTiles) return { error: "leap_out_of_range" };

	// Reject wall tiles.
	if (opacityMask && opacityMask[targetTileIdx] === 1) return { error: "leap_into_wall" };

	// Reject tiles already occupied by a living actor.
	const occupant = Object.values(floorState.actorsById).find(
		(a) => a.alive && a.idx === targetTileIdx && a.id !== caster.id,
	);
	if (occupant) return { error: "leap_tile_occupied" };

	// Teleport caster.
	const movedCaster: Actor = { ...caster, idx: targetTileIdx };
	const events: GameEvent[] = [];

	const statMod =
		effect.scalingStat !== undefined
			? abilityModifier(movedCaster.attributes[effect.scalingStat])
			: 0;

	// AoE on landing.
	let actorsById: Record<string, Actor> = {
		...floorState.actorsById,
		[caster.id]: movedCaster,
	};

	for (const [id, actor] of Object.entries(actorsById)) {
		if (!actor.alive || id === caster.id) continue;

		const { x: ax, y: ay } = idxToXY(actor.idx, width);
		if (chebyshevDistance(ax, ay, tx, ty) > effect.landingRadiusTiles) continue;

		const rawDamage = rollDiceExpr(rng, effect.dice);
		const rawAmount = Math.max(0, rawDamage + statMod);

		const rawPackets: Parameters<typeof resolveDamagePackets>[0] = [
			{ damageType: effect.damageType, rawAmount, effectiveAmount: 0 },
		];

		// Apply passive area/any damage bonuses.
		rawPackets.push(
			...collectPassiveBonusPackets(
				movedCaster,
				rng,
				"area",
				false,
				false,
				effect.damageType,
			),
		);

		// Data-driven area damage adjustments from active effects.
		rawPackets.push(
			...collectActiveEffectDamagePackets(movedCaster, rng, "area", effect.damageType),
		);

		const resolved = resolveDamagePackets(rawPackets, actor);
		const effectiveDamage = resolved.totalEffectiveDamage;

		const { updatedActor, events: damageEvents } = applyDamageToActor(actor, effectiveDamage);
		actorsById = { ...actorsById, [id]: updatedActor };
		events.push(...damageEvents);

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

	return {
		floorState: { ...floorState, actorsById },
		caster: movedCaster,
		events,
	};
}
