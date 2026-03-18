/**
 * Apply status effect: pushes a named ActiveEffect onto the caster's statusEffects array.
 * If the same statusId is already active its duration is replaced (refresh, not stack).
 */

import type { Actor, GameEvent } from "../../game/types";
import type { ApplyStatusEffect } from "../types";

export function applyStatusEffect(
	effect: ApplyStatusEffect,
	caster: Actor,
): { caster: Actor; events: GameEvent[] } {
	const filtered = caster.statusEffects.filter((e) => e.id !== effect.statusId);
	const updatedCaster: Actor = {
		...caster,
		statusEffects: [...filtered, { id: effect.statusId, remainingTurns: effect.durationTurns }],
	};

	const events: GameEvent[] = [
		{
			type: "status_applied",
			actorId: caster.id,
			statusId: effect.statusId,
			durationTurns: effect.durationTurns,
		},
	];

	return { caster: updatedCaster, events };
}
