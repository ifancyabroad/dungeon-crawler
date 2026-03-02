/**
 * Derive map config (with seed) and hero for the current floor from GameState.
 * Used by MainScene to avoid duplicating floor/config logic.
 * Hero is floorIndex + idx; MainScene converts idx to x,y/pixels when needed.
 */

import { getHero, type GameState, type MapGenConfig } from "@app/shared";

export interface MapConfigAndHero {
	config: MapGenConfig;
	hero: { floorIndex: number; idx: number };
}

/**
 * Returns config (with seed for current floor) and hero from state, or null if state has no floors.
 */
export function getMapConfigAndHeroFromState(state: GameState): MapConfigAndHero | null {
	const floorIndex = state.heroFloorIndex;
	const floor = state.floors[floorIndex] ?? state.floors[0];
	if (!floor) return null;
	const hero = getHero(state);
	if (!hero) return null;
	return {
		config: { ...floor.config, seed: state.seed + floorIndex },
		hero: { floorIndex, idx: hero.idx },
	};
}
