/**
 * Derive map config (with seed) and hero for the current floor from GameState.
 * Used by MainScene to avoid duplicating floor/config logic.
 */

import type { GameState } from "@app/shared";
import type { MapGenConfig } from "@app/shared";

export interface MapConfigAndHero {
	config: MapGenConfig;
	hero: { floorIndex: number; x: number; y: number };
}

/**
 * Returns config (with seed for current floor) and hero from state, or null if state has no floors.
 */
export function getMapConfigAndHeroFromState(state: GameState): MapConfigAndHero | null {
	const floorIndex = state.hero.floorIndex;
	const floor = state.floors[floorIndex] ?? state.floors[0];
	if (!floor) return null;
	return {
		config: { ...floor.config, seed: state.seed + floorIndex },
		hero: state.hero,
	};
}
