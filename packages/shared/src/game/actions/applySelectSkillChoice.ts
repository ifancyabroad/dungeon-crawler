import type { SelectSkillChoiceAction } from "../actions";
import type { Actor, GameState } from "../types";
import type { ApplyActionContext, ApplyActionResult } from "../engineContext";
import { createRngFromState } from "../../rng";
import { applyPassiveSkill } from "../../skills";
import { getHero } from "../engineUtils";
import { checkForLevelUp } from "../engineLevelUp";

export function applySelectSkillChoice(
	action: SelectSkillChoiceAction,
	state: GameState,
	context: ApplyActionContext,
): ApplyActionResult {
	const pi = state.pendingInteraction;
	if (pi?.type !== "skill_choice") {
		return { ok: false, reason: "no_pending_choice" };
	}

	const offer = pi.offers.find((o) => o.skillId === action.skillId);
	if (!offer) {
		return { ok: false, reason: "skill_not_in_offers" };
	}

	const skillDef = context.getSkillDef(action.skillId);
	if (!skillDef) return { ok: false, reason: "skill_unknown" };

	const fi = state.heroFloorIndex;
	const floor = state.floors[fi];
	if (!floor) return { ok: false, reason: "no_floor" };
	const hero = getHero(state);
	if (!hero) return { ok: false, reason: "no_hero" };

	const previousRank = hero.skills[action.skillId]?.rank ?? 0;
	const newRank = offer.rank;

	// Grant (new) or upgrade (existing) the skill
	let heroWithSkill: Actor = {
		...hero,
		skills: {
			...hero.skills,
			[action.skillId]: { rank: newRank, cooldownRemaining: 0 },
		},
	};

	// Apply passive effects permanently (delta from previous rank)
	if (skillDef.skillType === "passive") {
		heroWithSkill = applyPassiveSkill(heroWithSkill, skillDef, previousRank, newRank);
	}

	// Check whether the hero's banked XP qualifies them for another level-up.
	const { rng: cascadeRng, getState: getCascadeRngState } = createRngFromState(state.rngState);
	const {
		actor: heroAfterCascade,
		events: cascadeEvents,
		pendingInteraction: cascadeInteraction,
	} = checkForLevelUp(heroWithSkill, state.heroId, cascadeRng, context.getClassSkillPools);

	const finalFloors = state.floors.slice();
	finalFloors[fi] = {
		...floor,
		state: {
			...floor.state,
			actorsById: { ...floor.state.actorsById, [state.heroId]: heroAfterCascade },
		},
	};

	return {
		ok: true,
		state: {
			...state,
			turn: state.turn + 1,
			floors: finalFloors,
			pendingInteraction: cascadeInteraction,
			rngState: getCascadeRngState(),
		},
		events: [
			{ type: "skill_granted", actorId: state.heroId, skillId: action.skillId },
			...cascadeEvents,
		],
	};
}
