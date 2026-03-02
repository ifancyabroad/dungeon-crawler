/**
 * Unit test: snapshot at turn 0 -> apply 2 actions -> replay from snapshot
 * reproduces same final turn, hero position, and rngState.
 */
import { describe, it, expect } from "vitest";
import {
	ActionSchema,
	applyAction,
	buildGameStateFromPersisted,
	createInitialState,
	DEFAULT_MAP_HEIGHT,
	DEFAULT_MAP_WIDTH,
	getHero,
} from "@app/shared";

const SEED = 12345;
const floorConfig = {
	width: DEFAULT_MAP_WIDTH,
	height: DEFAULT_MAP_HEIGHT,
	theme: "green_forest",
	algorithm: "cave" as const,
	caveFloorChance: 0.45,
	scatterChance: 0.28,
};

describe("gameState replay", () => {
	it("snapshot turn 0 -> apply 2 actions -> replay reproduces turn, hero, rngState", () => {
		const state0 = createInitialState(SEED, floorConfig);
		const persisted0 = {
			turn: state0.turn,
			heroId: state0.heroId,
			heroFloorIndex: state0.heroFloorIndex,
			floors: state0.floors.map((f) => f.state),
			rngState: state0.rngState,
		};

		const fullState0 = buildGameStateFromPersisted(
			SEED,
			state0.mapGenVersion,
			state0.floors.map((f) => f.config),
			persisted0,
		);

		const moveRight = ActionSchema.parse({ type: "move", direction: "right" });
		const moveDown = ActionSchema.parse({ type: "move", direction: "down" });

		const r1 = applyAction(fullState0, moveRight);
		expect(r1.ok).toBe(true);
		const state1 = r1.ok ? r1.state : fullState0;
		const r2 = applyAction(state1, moveDown);
		expect(r2.ok).toBe(true);
		const state2 = r2.ok ? r2.state : state1;

		expect(state2.turn).toBe(2);
		const expectedHero = getHero(state2);
		expect(expectedHero).toBeDefined();
		const expectedRngState = state2.rngState;

		let replayed = buildGameStateFromPersisted(
			SEED,
			state0.mapGenVersion,
			state0.floors.map((f) => f.config),
			persisted0,
		);
		const actions = [moveRight, moveDown];
		for (const action of actions) {
			const result = applyAction(replayed, action);
			expect(result.ok).toBe(true);
			replayed = result.ok ? result.state : replayed;
		}

		expect(replayed.turn).toBe(2);
		const replayedHero = getHero(replayed);
		expect(replayedHero).toBeDefined();
		expect(replayedHero).toEqual(expectedHero);
		expect(replayed.rngState).toEqual(expectedRngState);
	});
});
