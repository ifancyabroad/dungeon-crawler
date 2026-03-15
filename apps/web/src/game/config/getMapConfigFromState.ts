/**
 * Derive map config (with seed) and hero for the current floor from GameState.
 * Used by MainScene to avoid duplicating floor/config logic.
 */

import { getHero, type FloorConfig, type GameState } from "@app/shared";

export interface MapConfigAndHero {
	config: FloorConfig & { seed: number };
	hero: { floorIndex: number; idx: number; classId: string };
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
	const config = {
		...floor.config,
		seed: state.seed + floorIndex,
	};
	const classId = hero.def.type === "hero" ? hero.def.classId : "warrior";
	return {
		config,
		hero: { floorIndex, idx: hero.idx, classId },
	};
}
