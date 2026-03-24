import { describe, it, expect } from "vitest";
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

const SEED = 12345;

describe("gameState replay", () => {
	it("snapshot turn 0 -> apply 2 actions -> replay reproduces turn, hero, rngState", () => {
		const state0 = createInitialState(SEED, [DEFAULT_FLOOR_CONFIG], DEFAULT_HERO_INIT);
		const persisted0 = gameStateToPersisted(state0);
		const fullState0 = buildGameStateFromPersisted(
			SEED,
			state0.mapGenVersion,
			state0.floors.map((f) => f.config),
			persisted0,
		);
		const moveRight = ActionSchema.parse({ type: "move", direction: "right" });
		const moveDown = ActionSchema.parse({ type: "move", direction: "down" });
		const r1 = applyActionWithDerivedContext(fullState0, moveRight);
		expect(r1.ok).toBe(true);
		const state1 = r1.ok ? r1.state : fullState0;
		const r2 = applyActionWithDerivedContext(state1, moveDown);
		expect(r2.ok).toBe(true);
		const state2 = r2.ok ? r2.state : state1;
		const expectedHero = getHero(state2);
		let replayed = buildGameStateFromPersisted(
			SEED,
			state0.mapGenVersion,
			state0.floors.map((f) => f.config),
			persisted0,
		);
		for (const action of [moveRight, moveDown]) {
			const result = applyActionWithDerivedContext(replayed, action);
			expect(result.ok).toBe(true);
			replayed = result.ok ? result.state : replayed;
		}
		expect(replayed.turn).toBe(2);
		expect(getHero(replayed)).toEqual(expectedHero);
		expect(replayed.rngState).toEqual(state2.rngState);
	});
});
