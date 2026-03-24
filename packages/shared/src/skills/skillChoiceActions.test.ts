import { describe, expect, it } from "vitest";
import {
	applyAction,
	buildGameStateFromPersisted,
	createInitialState,
	DEFAULT_FLOOR_CONFIG,
	DEFAULT_HERO_INIT,
	gameStateToPersisted,
	getHero,
} from "../index";
import {
	buildContext,
	makePendingSkillChoiceState,
	mockPools,
	mockSkillDefs,
	SEED,
} from "./skillSystem.fixtures";

describe("select_skill_choice and reroll_skill_choice", () => {
	it("regular actions are blocked while pendingInteraction is set", () => {
		const state = makePendingSkillChoiceState();
		const result = applyAction(
			state,
			{ type: "move", direction: "right" },
			buildContext(state, mockSkillDefs, mockPools),
		);
		expect(result.ok).toBe(false);
	});

	it("select_skill_choice grants skill and clears interaction", () => {
		const state = makePendingSkillChoiceState();
		const before = getHero(state)!.attributes.strength;
		const result = applyAction(
			state,
			{ type: "select_skill_choice", skillId: "passive_str" },
			buildContext(state, mockSkillDefs, mockPools),
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(getHero(result.state)!.attributes.strength).toBe(before + 2);
		expect(result.state.pendingInteraction).toBeNull();
	});

	it("pendingInteraction survives persisted round-trip", () => {
		const state = makePendingSkillChoiceState();
		const restored = buildGameStateFromPersisted(
			state.seed,
			state.mapGenVersion,
			state.floors.map((f) => f.config),
			gameStateToPersisted(state),
		);
		expect(restored.pendingInteraction).toEqual(state.pendingInteraction);
	});

	it("reroll fails when no pendingInteraction", () => {
		const state = createInitialState(SEED, [DEFAULT_FLOOR_CONFIG], DEFAULT_HERO_INIT);
		const result = applyAction(
			state,
			{ type: "reroll_skill_choice" },
			buildContext(state, mockSkillDefs, mockPools),
		);
		expect(result.ok).toBe(false);
	});
});
