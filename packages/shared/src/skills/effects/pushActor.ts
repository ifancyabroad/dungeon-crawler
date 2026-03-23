/**
 * Push actor effect: shoves the target away from the caster in a straight cardinal direction.
 *
 * Resolution:
 *  1. Compute the cardinal direction from caster → target.
 *  2. Walk the target tile-by-tile in that direction.
 *  3. Stop when a wall (opacityMask) or occupied tile is reached.
 *  4. If stopped by a collision (not a free push), optionally deal wall-impact damage.
 *  5. Emit actor_pushed with the final position.
 *
 * Only cardinal movement (N/S/E/W) is supported; diagonal pushes are rounded to
 * the dominant axis. If caster and target share the same tile the effect is a no-op.
 */

import type { Actor, FloorState, GameEvent } from "../../game/types";
import type { Rng } from "../../rng";
import type { PushActorEffect } from "../types";
import { rollDiceExpr } from "../../combat/dice";
import { resolveDamagePackets } from "../../combat/resolveDamage";
import { applyDamageToActor } from "../../combat/applyDamageToActor";
import { idxToXY, xyToIdx } from "../../game/engine";

export function applyPushActor(
	effect: PushActorEffect,
	caster: Actor,
	targetActorId: string,
	floorState: FloorState,
	width: number,
	height: number,
	rng: Rng,
	skillId: string,
	opacityMask?: Uint8Array,
): { floorState: FloorState; events: GameEvent[] } | { error: string } {
	const target = floorState.actorsById[targetActorId];
	if (!target || !target.alive) return { error: "push_no_target" };

	const { x: cx, y: cy } = idxToXY(caster.idx, width);
	const { x: tx, y: ty } = idxToXY(target.idx, width);

	const dx = tx - cx;
	const dy = ty - cy;
	if (dx === 0 && dy === 0) return { floorState, events: [] };

	// Round to dominant cardinal axis.
	let stepX = 0;
	let stepY = 0;
	if (Math.abs(dx) >= Math.abs(dy)) {
		stepX = dx > 0 ? 1 : -1;
	} else {
		stepY = dy > 0 ? 1 : -1;
	}

	const events: GameEvent[] = [];
	let currentX = tx;
	let currentY = ty;
	let tilesActuallyPushed = 0;
	let blockedByCollision = false;

	for (let i = 0; i < effect.maxPushTiles; i++) {
		const nextX = currentX + stepX;
		const nextY = currentY + stepY;

		// Out-of-bounds.
		if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) {
			blockedByCollision = true;
			break;
		}

		const nextIdx = xyToIdx(nextX, nextY, width);

		// Wall collision.
		if (opacityMask && opacityMask[nextIdx] === 1) {
			blockedByCollision = true;
			break;
		}

		// Occupied by another living actor (not the caster or target themselves).
		const occupant = Object.values(floorState.actorsById).find(
			(a) => a.alive && a.idx === nextIdx && a.id !== caster.id && a.id !== targetActorId,
		);
		if (occupant) {
			blockedByCollision = true;
			break;
		}

		currentX = nextX;
		currentY = nextY;
		tilesActuallyPushed++;
	}

	const fromIdx = target.idx;
	const toIdx = xyToIdx(currentX, currentY, width);
	let updatedTarget: Actor = { ...target, idx: toIdx };

	events.push({ type: "actor_pushed", actorId: targetActorId, fromIdx, toIdx, skillId });

	// Wall-impact damage when the push was stopped before full range by a collision.
	if (
		blockedByCollision &&
		tilesActuallyPushed < effect.maxPushTiles &&
		effect.wallDamageDice &&
		effect.wallDamageType
	) {
		const rawAmount = rollDiceExpr(rng, effect.wallDamageDice);
		const rawPackets: Parameters<typeof resolveDamagePackets>[0] = [
			{ damageType: effect.wallDamageType, rawAmount, effectiveAmount: 0 },
		];
		const resolved = resolveDamagePackets(rawPackets, updatedTarget);
		const { updatedActor, events: damageEvents } = applyDamageToActor(
			updatedTarget,
			resolved.totalEffectiveDamage,
		);
		updatedTarget = updatedActor;
		events.push(...damageEvents);
		events.push({
			type: "area_hit",
			attackerId: caster.id,
			defenderId: targetActorId,
			damage: resolved.totalEffectiveDamage,
			damagePackets: resolved.packets,
			skillId,
		});
		if (!updatedTarget.alive) {
			events.push({ type: "death", actorId: targetActorId });
		}
	}

	return {
		floorState: {
			...floorState,
			actorsById: { ...floorState.actorsById, [targetActorId]: updatedTarget },
		},
		events,
	};
}
