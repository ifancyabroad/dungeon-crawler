import { describe, expect, it } from "vitest";
import { applyAction, getHero } from "../index";
import {
	buildContext,
	makePendingSkillChoiceState,
	mockPools,
	mockSkillDefs,
} from "./skillSystem.fixtures";

describe("skill system determinism", () => {
	it("same seed and same select_skill_choice yield identical outcomes", () => {
		const run = () => {
			const state = makePendingSkillChoiceState();
			return applyAction(
				state,
				{ type: "select_skill_choice", skillId: "passive_str" },
				buildContext(state, mockSkillDefs, mockPools),
			);
		};
		const first = run();
		const second = run();
		expect(first.ok).toBe(true);
		expect(second.ok).toBe(true);
		if (!first.ok || !second.ok) return;
		expect(first.state.rngState).toEqual(second.state.rngState);
		expect(getHero(first.state)?.attributes.strength).toBe(
			getHero(second.state)?.attributes.strength,
		);
	});
});
