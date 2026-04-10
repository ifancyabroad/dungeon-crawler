import type { RerollSkillChoiceAction } from "./schemas";
import type { Actor, GameState } from "../types";
import type { ApplyActionContext, ApplyActionResult } from "../engineContext";
import { createRngFromState } from "../../rng";
import { getHero } from "../engineUtils";
import { generateSkillOffers } from "../engineLevelUp";

export function applyRerollSkillChoice(
	_action: RerollSkillChoiceAction,
	state: GameState,
	context: ApplyActionContext,
): ApplyActionResult {
	const pi = state.pendingInteraction;
	if (pi?.type !== "skill_choice") {
		return { ok: false, reason: "no_pending_choice" };
	}

	const hero = getHero(state);
	if (!hero) return { ok: false, reason: "no_hero" };

	// Gold cost check.
	if (hero.gold < pi.rerollCost) {
		return { ok: false, reason: "insufficient_gold" };
	}

	const classId = hero.def.type === "hero" ? hero.def.classId : null;
	const pools = classId ? context.getClassSkillPools(classId) : undefined;
	if (!pools) return { ok: false, reason: "no_skill_pools" };

	const { rng, getState: getRngState } = createRngFromState(state.rngState);

	// Exclude skills already shown in this offer to encourage variety
	const currentOfferSkillIds = new Set(pi.offers.map((o) => o.skillId));
	const newOffers = generateSkillOffers(hero, pools, rng, currentOfferSkillIds);

	const fi = state.heroFloorIndex;
	const floor = state.floors[fi];
	if (!floor) return { ok: false, reason: "no_floor" };
	const heroAfterGold: Actor = { ...hero, gold: hero.gold - pi.rerollCost };
	const rerolledFloors = state.floors.slice();
	rerolledFloors[fi] = {
		...floor,
		state: {
			...floor.state,
			actorsById: { ...floor.state.actorsById, [state.heroId]: heroAfterGold },
		},
	};

	return {
		ok: true,
		state: {
			...state,
			turn: state.turn + 1,
			rngState: getRngState(),
			floors: rerolledFloors,
			pendingInteraction: {
				...pi,
				offers: newOffers,
				rerollsUsed: pi.rerollsUsed + 1,
			},
		},
		events: [],
	};
}
