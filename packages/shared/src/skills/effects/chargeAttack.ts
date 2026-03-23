/**
 * Charge attack effect: validates that the target actor is in a straight cardinal line within
 * maxRangeTiles, then moves the caster to the adjacent tile and resolves a melee attack.
 * A bonus damage dice (bonusDice) is rolled on a hit, doubled on a critical (5e rule).
 */

import type { Actor, FloorState, GameEvent } from "../../game/types";
import type { Rng } from "../../rng";
import type { ChargeAttackEffect } from "../types";
import { resolveAttack } from "../../combat/combat";
import { UNARMED_WEAPON } from "../../combat/types";
import { rollDiceExpr } from "../../combat/dice";
import { resolveDamagePackets } from "../../combat/resolveDamage";
import { applyDamageToActor } from "../../combat/applyDamageToActor";
import { idxToXY, xyToIdx, getAdjacentIndices } from "../../game/engineUtils";

/**
 * Returns true if `from` and `to` are aligned on a single cardinal axis
 * and within maxRange tiles (Manhattan on that axis).
 */
function isStraightLine(fromIdx: number, toIdx: number, width: number, maxRange: number): boolean {
	const { x: fx, y: fy } = idxToXY(fromIdx, width);
	const { x: tx, y: ty } = idxToXY(toIdx, width);
	const dx = tx - fx;
	const dy = ty - fy;
	if (dx !== 0 && dy !== 0) return false; // not cardinal
	const dist = Math.abs(dx) + Math.abs(dy);
	return dist >= 2 && dist <= maxRange; // must be at least 2 tiles away to charge
}

/**
 * Return the tile adjacent to `targetIdx` that is closest to `heroIdx` (on the same axis).
 * Assumes isStraightLine has already confirmed alignment.
 */
function landingTile(heroIdx: number, targetIdx: number, width: number): number {
	const { x: hx, y: hy } = idxToXY(heroIdx, width);
	const { x: tx, y: ty } = idxToXY(targetIdx, width);
	if (tx === hx) {
		// vertical axis — land on tile directly above or below target
		const dy = ty > hy ? -1 : 1;
		return xyToIdx(tx, ty + dy, width);
	}
	// horizontal axis — land on tile directly left or right of target
	const ddx = tx > hx ? -1 : 1;
	return xyToIdx(tx + ddx, ty, width);
}

export function applyChargeAttack(
	effect: ChargeAttackEffect,
	caster: Actor,
	targetActorId: string,
	floorState: FloorState,
	width: number,
	height: number,
	rng: Rng,
	skillId: string,
): { floorState: FloorState; caster: Actor; events: GameEvent[] } | { error: string } {
	const target = floorState.actorsById[targetActorId];
	if (!target || !target.alive) return { error: "charge_no_target" };

	if (!isStraightLine(caster.idx, target.idx, width, effect.maxRangeTiles)) {
		return { error: "charge_not_in_line" };
	}

	const landing = landingTile(caster.idx, target.idx, width);
	const adjacents = getAdjacentIndices(target.idx, width, height);
	if (!adjacents.includes(landing)) {
		return { error: "charge_bad_landing" };
	}

	// Move caster to landing tile
	const movedCaster: Actor = { ...caster, idx: landing };

	// Resolve base melee attack, then add bonus dice on a hit.
	// Bonus dice are doubled on a crit (5e rule), no ability modifier added.
	const baseResult = resolveAttack(movedCaster, target, rng, UNARMED_WEAPON);
	const bonusRawRoll = baseResult.hit
		? rollDiceExpr(rng, effect.bonusDice, baseResult.critical ? 2 : 1)
		: 0;
	const bonusResolved =
		baseResult.hit && bonusRawRoll > 0
			? resolveDamagePackets(
					[
						{
							damageType: effect.bonusDamageType,
							rawAmount: bonusRawRoll,
							// resolveDamagePackets overwrites effectiveAmount.
							effectiveAmount: 0,
						},
					],
					target,
				)
			: { packets: [], totalEffectiveDamage: 0 };

	const damage = baseResult.hit ? baseResult.damage + bonusResolved.totalEffectiveDamage : 0;
	const attackResult = {
		...baseResult,
		damage,
		damagePackets: [...baseResult.damagePackets, ...bonusResolved.packets],
	};

	const events: GameEvent[] = [
		{
			type: "skill_hit",
			attackerId: caster.id,
			defenderId: targetActorId,
			skillId,
			result: attackResult,
		},
	];

	let updatedTarget: Actor = target;
	if (attackResult.hit) {
		const { updatedActor, events: damageEvents } = applyDamageToActor(target, damage);
		updatedTarget = updatedActor;
		events.push(...damageEvents);
		if (!updatedTarget.alive) {
			events.push({ type: "death", actorId: targetActorId });
		}
	}

	const newActorsById = {
		...floorState.actorsById,
		[caster.id]: movedCaster,
		[targetActorId]: updatedTarget,
	};

	return {
		floorState: { ...floorState, actorsById: newActorsById },
		caster: movedCaster,
		events,
	};
}
