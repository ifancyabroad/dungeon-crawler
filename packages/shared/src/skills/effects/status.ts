/**
 * Apply status effect: pushes a named ActiveEffect onto the caster's activeEffects array.
 * If the same effectId is already active its duration is replaced (refresh, not stack).
 */

import type { Actor, GameEvent } from "../../game/types";
import type { ApplyStatusEffect } from "../types";

export function applyStatusEffect(
	effect: ApplyStatusEffect,
	caster: Actor,
	sourceSkillId: string | undefined,
	casterId: string,
): { caster: Actor; events: GameEvent[] } {
	const filtered = caster.activeEffects.filter((e) => e.id !== effect.statusId);
	const newEffect = {
		id: effect.statusId,
		remainingTurns: effect.durationTurns,
		sourceActorId: casterId,
		...(effect.value !== undefined && { value: effect.value }),
		...(effect.adjustments !== undefined && { adjustments: effect.adjustments }),
		...(sourceSkillId !== undefined && { sourceSkillId }),
	};
	const updatedCaster: Actor = {
		...caster,
		activeEffects: [...filtered, newEffect],
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
