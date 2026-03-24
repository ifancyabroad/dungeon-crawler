import { describe, expect, it } from "vitest";
import {
	ActionSchema,
	applyActionWithDerivedContext,
	buildGameStateFromPersisted,
	createInitialState,
	DEFAULT_FLOOR_CONFIG,
	DEFAULT_HERO_INIT,
	gameStateToPersisted,
	getHero,
} from "../index";

const SEED = 1337;

function getFirstValidMoveDirection(state: ReturnType<typeof createInitialState>) {
	const directions = ["up", "down", "left", "right"] as const;
	return directions.find((direction) => {
		const result = applyActionWithDerivedContext(
			state,
			ActionSchema.parse({ type: "move", direction }),
		);
		return result.ok;
	});
}

describe("engine determinism", () => {
	it("same seed and actions produce identical turn, hero position, and rng state", () => {
		const stateA0 = createInitialState(SEED, [DEFAULT_FLOOR_CONFIG], DEFAULT_HERO_INIT);
		const stateB0 = createInitialState(SEED, [DEFAULT_FLOOR_CONFIG], DEFAULT_HERO_INIT);
		const direction = getFirstValidMoveDirection(stateA0);
		expect(direction).toBeDefined();
		if (!direction) return;

		const action = ActionSchema.parse({ type: "move", direction });
		const runA = applyActionWithDerivedContext(stateA0, action);
		const runB = applyActionWithDerivedContext(stateB0, action);
		expect(runA.ok).toBe(true);
		expect(runB.ok).toBe(true);
		if (!runA.ok || !runB.ok) return;

		expect(runA.state.turn).toBe(runB.state.turn);
		expect(getHero(runA.state)?.idx).toBe(getHero(runB.state)?.idx);
		expect(runA.state.rngState).toEqual(runB.state.rngState);
	});

	it("replay from persisted snapshot matches direct action application", () => {
		const state0 = createInitialState(SEED, [DEFAULT_FLOOR_CONFIG], DEFAULT_HERO_INIT);
		const persisted0 = gameStateToPersisted(state0);
		const replayBase = buildGameStateFromPersisted(
			state0.seed,
			state0.mapGenVersion,
			state0.floors.map((floor) => floor.config),
			persisted0,
		);
		const direction = getFirstValidMoveDirection(replayBase);
		expect(direction).toBeDefined();
		if (!direction) return;

		const action = ActionSchema.parse({ type: "move", direction });
		const direct = applyActionWithDerivedContext(replayBase, action);
		expect(direct.ok).toBe(true);
		if (!direct.ok) return;

		const replayed0 = buildGameStateFromPersisted(
			state0.seed,
			state0.mapGenVersion,
			state0.floors.map((floor) => floor.config),
			persisted0,
		);
		const replayed = applyActionWithDerivedContext(replayed0, action);
		expect(replayed.ok).toBe(true);
		if (!replayed.ok) return;

		expect(replayed.state.turn).toBe(direct.state.turn);
		expect(getHero(replayed.state)?.idx).toBe(getHero(direct.state)?.idx);
		expect(replayed.state.rngState).toEqual(direct.state.rngState);
	});
});
