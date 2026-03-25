/**
 * Modify numeric buff effect: set, add to, or clamp a value in actor.numericBuffs.
 *
 * Operations:
 *   "set"       — replace the current value unconditionally.
 *   "add"       — add value to current (missing key treated as 0).
 *   "clamp_min" — raise the current value to at least `value` (floor).
 *   "clamp_max" — lower the current value to at most `value` (ceiling).
 *
 * Target: "self" (default) = caster; "target" = the targeted actor.
 */

import type { Actor, FloorState, GameEvent } from "../../game/types";
import type { ModifyNumericBuffEffect } from "../types";

function applyOp(current: number, op: ModifyNumericBuffEffect["operation"], value: number): number {
	switch (op) {
		case "set":
			return value;
		case "add":
			return current + value;
		case "clamp_min":
			return Math.max(current, value);
		case "clamp_max":
			return Math.min(current, value);
	}
}

export function applyModifyNumericBuff(
	effect: ModifyNumericBuffEffect,
	caster: Actor,
	targetActorId: string | undefined,
	floorState: FloorState,
): { floorState: FloorState; caster: Actor; events: GameEvent[] } {
	const resolvedTarget = effect.target ?? "self";

	if (resolvedTarget === "target" && targetActorId) {
		const target = floorState.actorsById[targetActorId];
		if (!target || !target.alive) {
			return { floorState, caster, events: [] };
		}
		const current = target.numericBuffs[effect.key] ?? 0;
		const newValue = applyOp(current, effect.operation, effect.value);
		const updatedTarget: Actor = {
			...target,
			numericBuffs: { ...target.numericBuffs, [effect.key]: newValue },
		};
		return {
			floorState: {
				...floorState,
				actorsById: { ...floorState.actorsById, [targetActorId]: updatedTarget },
			},
			caster,
			events: [],
		};
	}

	// Default: self
	const current = caster.numericBuffs[effect.key] ?? 0;
	const newValue = applyOp(current, effect.operation, effect.value);
	const updatedCaster: Actor = {
		...caster,
		numericBuffs: { ...caster.numericBuffs, [effect.key]: newValue },
	};

	return {
		floorState: {
			...floorState,
			actorsById: { ...floorState.actorsById, [caster.id]: updatedCaster },
		},
		caster: updatedCaster,
		events: [],
	};
}
