/**
 * Reduce cooldowns effect: lowers cooldownRemaining on the caster's skills.
 * Optionally filtered to a specific list of skill IDs; omitting the filter reduces all.
 * Cooldowns are clamped at 0 (cannot go negative).
 */

import type { Actor, GameEvent } from "../../game/types";
import type { ReduceCooldownsEffect } from "../types";

export function applyReduceCooldowns(
	effect: ReduceCooldownsEffect,
	caster: Actor,
): { caster: Actor; events: GameEvent[] } {
	const filter = effect.skillIds ? new Set(effect.skillIds) : null;
	const updatedSkills = { ...caster.skills };

	for (const [id, state] of Object.entries(updatedSkills)) {
		if (filter && !filter.has(id)) continue;
		if (state.cooldownRemaining <= 0) continue;
		updatedSkills[id] = {
			...state,
			cooldownRemaining: Math.max(0, state.cooldownRemaining - effect.amount),
		};
	}

	return { caster: { ...caster, skills: updatedSkills }, events: [] };
}
