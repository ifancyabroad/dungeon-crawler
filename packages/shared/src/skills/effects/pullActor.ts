/**
 * Pull actor effect: drags the target toward the caster in a straight cardinal direction.
 * The inverse of push_actor — direction vector points from target toward caster.
 *
 * Resolution:
 *  1. Compute the cardinal direction from target → caster.
 *  2. Walk the target tile-by-tile in that direction.
 *  3. Stop one tile before the caster (occupant check) or at a wall/occupied tile.
 *  4. If stopped by a collision, optionally deal wall-impact damage.
 *  5. Emit actor_pushed with the final position.
 *
 * Only cardinal movement (N/S/E/W) is supported; diagonal pulls are rounded to
 * the dominant axis. If caster and target share the same tile the effect is a no-op.
 */

import type { Actor, FloorState, GameEvent } from "../../game/types";
import type { Rng } from "../../rng";
import type { PullActorEffect } from "../types";
import { rollDiceExpr } from "../../combat/dice";
import { resolveDamagePackets } from "../../combat/resolveDamage";
import { applyDamageToActor } from "../../combat/applyDamageToActor";
import { idxToXY, xyToIdx } from "../../game/engineUtils";

export function applyPullActor(
	effect: PullActorEffect,
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
	if (!target || !target.alive) return { error: "pull_no_target" };

	const { x: cx, y: cy } = idxToXY(caster.idx, width);
	const { x: tx, y: ty } = idxToXY(target.idx, width);

	const dx = cx - tx;
	const dy = cy - ty;
	if (dx === 0 && dy === 0) return { floorState, events: [] };

	// Round to dominant cardinal axis (toward caster).
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
	let tilesActuallyPulled = 0;
	let blockedByCollision = false;

	for (let i = 0; i < effect.maxPullTiles; i++) {
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

		// Occupied by another living actor (stop before colliding — includes the caster).
		const occupant = Object.values(floorState.actorsById).find(
			(a) => a.alive && a.idx === nextIdx && a.id !== targetActorId,
		);
		if (occupant) {
			blockedByCollision = true;
			break;
		}

		currentX = nextX;
		currentY = nextY;
		tilesActuallyPulled++;
	}

	const fromIdx = target.idx;
	const toIdx = xyToIdx(currentX, currentY, width);
	let updatedTarget: Actor = { ...target, idx: toIdx };

	events.push({ type: "actor_pushed", actorId: targetActorId, fromIdx, toIdx, skillId });

	// Collision damage when the pull was stopped before full range.
	if (
		blockedByCollision &&
		tilesActuallyPulled < effect.maxPullTiles &&
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
