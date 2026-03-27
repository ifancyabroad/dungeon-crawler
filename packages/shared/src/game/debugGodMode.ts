/**
 * Debug god mode: post-process state + events after a normal engine apply.
 * When enabled, the hero cannot remain dead (clamped to 1 HP, alive) and hero death events are removed.
 *
 * Pure and deterministic — no RNG or time. Used by the API after authoritative apply and by the
 * web client for optimistic apply so UI matches server without duplicating logic.
 */
import type { GameEvent, GameState } from "./types";
import { getHero } from "./engineUtils";

export function applyGodModePostProcess(
	state: GameState,
	events: GameEvent[],
	godMode: boolean,
): { state: GameState; events: GameEvent[] } {
	if (!godMode) return { state, events };

	const hero = getHero(state);
	if (!hero || hero.alive) {
		return {
			state,
			events: events.filter((e) => !(e.type === "death" && e.actorId === state.heroId)),
		};
	}

	const floorIdx = state.heroFloorIndex;
	const floorState = state.floors[floorIdx].state;
	const revivedHero = { ...hero, hp: 1, alive: true };
	const guardedState: GameState = {
		...state,
		floors: state.floors.map((f, i) =>
			i === floorIdx
				? {
						...f,
						state: {
							...floorState,
							actorsById: {
								...floorState.actorsById,
								[revivedHero.id]: revivedHero,
							},
						},
					}
				: f,
		),
	};
	const guardedEvents = events.filter(
		(e) => !(e.type === "death" && e.actorId === guardedState.heroId),
	);
	return { state: guardedState, events: guardedEvents };
}
