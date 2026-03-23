/**
 * Teleport swap effect: instantly exchanges positions of the caster and a target actor.
 * Emits a teleport_swap event for client animation.
 */

import type { Actor, FloorState, GameEvent } from "../../game/types";
import type { TeleportSwapEffect } from "../types";

export function applyTeleportSwap(
	_effect: TeleportSwapEffect,
	caster: Actor,
	targetActorId: string,
	floorState: FloorState,
	skillId: string,
): { floorState: FloorState; caster: Actor; events: GameEvent[] } | { error: string } {
	const target = floorState.actorsById[targetActorId];
	if (!target || !target.alive) return { error: "teleport_swap_no_target" };
	if (targetActorId === caster.id) return { error: "teleport_swap_self" };

	const casterNewIdx = target.idx;
	const targetNewIdx = caster.idx;

	const updatedCaster: Actor = { ...caster, idx: casterNewIdx };
	const updatedTarget: Actor = { ...target, idx: targetNewIdx };

	const newFloorState: FloorState = {
		...floorState,
		actorsById: {
			...floorState.actorsById,
			[caster.id]: updatedCaster,
			[targetActorId]: updatedTarget,
		},
	};

	const events: GameEvent[] = [
		{
			type: "teleport_swap",
			casterId: caster.id,
			targetId: targetActorId,
			casterNewIdx,
			targetNewIdx,
			skillId,
		},
	];

	return { floorState: newFloorState, caster: updatedCaster, events };
}
