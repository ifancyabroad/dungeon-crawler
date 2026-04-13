import type { WaitAction } from "./schemas";
import type { GameState } from "../types";
import type { ApplyActionContext, ApplyActionResult } from "../engineContext";
import { createRngFromState } from "../../rng";
import { tickActiveEffects } from "../../skills";
import { getHero, tickSkillCooldowns } from "../engineUtils";
import { processEnemyTurns } from "../engineEnemyTurns";

/**
 * Wait / pass turn. The hero does nothing; enemies act and all active effects tick.
 * Always succeeds regardless of status effects — this is the escape hatch for
 * STUNNED and ROOTED conditions that would otherwise block all player input.
 */
export function applyWait(
	_action: WaitAction,
	state: GameState,
	context: ApplyActionContext,
): ApplyActionResult {
	const hero = getHero(state);
	if (!hero || !hero.alive) return { ok: false, reason: "wait_no_hero" };

	const fi = state.heroFloorIndex;
	const floor = state.floors[fi];
	if (!floor) return { ok: false, reason: "wait_no_floor" };

	const { width, height } = floor.config;
	const { rng, getState: getRngState } = createRngFromState(state.rngState);
	const mask = context.getWalkableMask(fi);
	const opacityMask = context.getOpacityMask(fi);

	const enemyResult = processEnemyTurns(
		floor.state,
		state.heroId,
		width,
		height,
		mask,
		opacityMask,
		rng,
		context.getSkillDef,
	);

	const newFloors = state.floors.slice();
	newFloors[fi] = { ...floor, state: enemyResult.floorState };

	let newState: GameState = {
		...state,
		turn: state.turn + 1,
		floors: newFloors,
		rngState: getRngState(),
	};

	const { state: tickedState, events: tickEvents } = tickActiveEffects(newState);
	newState = tickSkillCooldowns(tickedState);

	return { ok: true, state: newState, events: [...enemyResult.events, ...tickEvents] };
}
