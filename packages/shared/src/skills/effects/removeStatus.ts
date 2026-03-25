/**
 * Remove status effect: strips one or more named ActiveEffects from self, target, or an AoE.
 * The inverse of applyStatusEffect. Silently skips IDs that are not currently active.
 */

import type { Actor, FloorState, GameEvent } from "../../game/types";
import type { RemoveStatusEffect } from "../types";
import { idxToXY } from "../../game/engineUtils";

function stripStatuses(actor: Actor, statusIds: string[]): { actor: Actor; events: GameEvent[] } {
	const toRemove = new Set(statusIds);
	const removed = actor.activeEffects.filter((e) => toRemove.has(e.id));
	if (removed.length === 0) return { actor, events: [] };

	const events: GameEvent[] = removed.map((e) => ({
		type: "status_removed" as const,
		actorId: actor.id,
		statusId: e.id,
	}));

	return {
		actor: {
			...actor,
			activeEffects: actor.activeEffects.filter((e) => !toRemove.has(e.id)),
		},
		events,
	};
}

export function applyRemoveStatus(
	effect: RemoveStatusEffect,
	caster: Actor,
	targetActorId: string | undefined,
	floorState: FloorState,
	width: number,
): { floorState: FloorState; caster: Actor; events: GameEvent[] } {
	const events: GameEvent[] = [];
	let currentCaster = caster;
	let actorsById = { ...floorState.actorsById };

	const resolvedTarget = effect.target ?? "self";

	if (resolvedTarget === "self") {
		const { actor, events: stripped } = stripStatuses(currentCaster, effect.statusIds);
		currentCaster = actor;
		actorsById = { ...actorsById, [caster.id]: currentCaster };
		events.push(...stripped);
	} else if (resolvedTarget === "target" && targetActorId) {
		const target = actorsById[targetActorId];
		if (target && target.alive) {
			const { actor, events: stripped } = stripStatuses(target, effect.statusIds);
			actorsById = { ...actorsById, [targetActorId]: actor };
			events.push(...stripped);
		}
	} else if (resolvedTarget === "aoe") {
		const radius = effect.aoeRadiusTiles ?? 1;
		const { x: cx, y: cy } = idxToXY(currentCaster.idx, width);
		for (const [id, actor] of Object.entries(actorsById)) {
			if (!actor.alive) continue;
			const { x: ax, y: ay } = idxToXY(actor.idx, width);
			const chebDist = Math.max(Math.abs(ax - cx), Math.abs(ay - cy));
			if (chebDist > radius) continue;
			const { actor: cleansed, events: stripped } = stripStatuses(actor, effect.statusIds);
			actorsById = { ...actorsById, [id]: cleansed };
			if (id === caster.id) currentCaster = cleansed;
			events.push(...stripped);
		}
	}

	return {
		floorState: { ...floorState, actorsById },
		caster: currentCaster,
		events,
	};
}
