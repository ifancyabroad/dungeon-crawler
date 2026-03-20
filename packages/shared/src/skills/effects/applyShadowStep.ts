/**
 * Shadow step effect: instantly teleports the caster to a target walkable,
 * unoccupied tile within range. Does not trigger normal movement side-effects.
 * Can only be used while in stealth (maintainsStealth handled at skill-definition level).
 */

import type { Actor, FloorState, GameEvent } from "../../game/types";
import type { ShadowStepEffect } from "../types";

export function applyShadowStep(
	_effect: ShadowStepEffect,
	caster: Actor,
	targetTileIdx: number,
	floorState: FloorState,
	opacityMask?: Uint8Array,
): { floorState: FloorState; caster: Actor; events: GameEvent[] } | { error: string } {
	// Reject wall tiles.
	if (opacityMask && opacityMask[targetTileIdx] === 1) {
		return { error: "shadow_step_into_wall" };
	}

	// Reject tiles occupied by a living actor other than the caster.
	const occupant = Object.values(floorState.actorsById).find(
		(a) => a.alive && a.idx === targetTileIdx && a.id !== caster.id,
	);
	if (occupant) return { error: "shadow_step_tile_occupied" };

	const movedCaster: Actor = { ...caster, idx: targetTileIdx };

	const events: GameEvent[] = [];
	// No damage events — pure movement. The skill_used event is emitted by resolveSkill.

	return {
		floorState: {
			...floorState,
			actorsById: { ...floorState.actorsById, [caster.id]: movedCaster },
		},
		caster: movedCaster,
		events,
	};
}
