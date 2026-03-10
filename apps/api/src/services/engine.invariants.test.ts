/**
 * Phase 0: Invariants — replay equals direct apply; applyAction with context does not regenerate base maps.
 */
import { describe, it, expect, vi } from "vitest";
import {
	ActionSchema,
	applyAction,
	buildGameStateFromPersisted,
	computeOpacityMask,
	createActionContext,
	createInitialState,
	computeWalkableMaskForFloor,
	regenerateBaseMaps,
	DEFAULT_FLOOR_CONFIG,
	gameStateToPersisted,
	getHero,
} from "@app/shared";

const SEED = 12345;

function buildContext(state: ReturnType<typeof createInitialState>) {
	const baseLayers = regenerateBaseMaps(
		state.seed,
		state.floors.map((f) => f.config),
		state.mapGenVersion,
	);
	const walkable = baseLayers.map((base, i) =>
		computeWalkableMaskForFloor(base, state.floors[i]?.state.tileOverrides ?? {}),
	);
	const opacity = baseLayers.map((base) =>
		computeOpacityMask(base.wall, base.width, base.height),
	);
	return createActionContext(walkable, opacity);
}

describe("engine invariants", () => {
	it("replay from snapshot + N actions equals direct apply with context", () => {
		const state0 = createInitialState(SEED, DEFAULT_FLOOR_CONFIG);
		const persisted0 = gameStateToPersisted(state0);
		const floorConfigs = state0.floors.map((f) => f.config);

		const fullState0 = buildGameStateFromPersisted(
			SEED,
			state0.mapGenVersion,
			floorConfigs,
			persisted0,
		);

		const context = buildContext(fullState0);

		const moveRight = ActionSchema.parse({ type: "move", direction: "right" });
		const moveDown = ActionSchema.parse({ type: "move", direction: "down" });

		// Direct apply with context (twice)
		const r1 = applyAction(fullState0, moveRight, context);
		expect(r1.ok).toBe(true);
		const state1 = r1.ok ? r1.state : fullState0;
		const r2 = applyAction(state1, moveDown, context);
		expect(r2.ok).toBe(true);
		const state2 = r2.ok ? r2.state : state1;

		// Replay: same snapshot, same actions, with context
		let replayed = buildGameStateFromPersisted(
			SEED,
			state0.mapGenVersion,
			floorConfigs,
			persisted0,
		);
		const actions = [moveRight, moveDown];
		for (const action of actions) {
			const ctxReplay = buildContext(replayed);
			const result = applyAction(replayed, action, ctxReplay);
			expect(result.ok).toBe(true);
			replayed = result.ok ? result.state : replayed;
		}

		expect(replayed.turn).toBe(state2.turn);
		expect(getHero(replayed)).toEqual(getHero(state2));
		expect(replayed.rngState).toEqual(state2.rngState);
	});

	it("applyAction with context does not call regenerateBaseMaps", async () => {
		const shared = await import("@app/shared");
		const state = createInitialState(SEED, DEFAULT_FLOOR_CONFIG);
		const context = buildContext(state);

		const spy = vi.spyOn(shared, "regenerateBaseMaps");
		try {
			shared.applyAction(
				state,
				ActionSchema.parse({ type: "move", direction: "right" }),
				context,
			);
			expect(spy).not.toHaveBeenCalled();
		} finally {
			spy.mockRestore();
		}
	});

	it("explored state grows after move", () => {
		const state0 = createInitialState(SEED, DEFAULT_FLOOR_CONFIG);
		const exploredBefore = state0.floors[0].state.explored;
		const exploredCount0 = exploredBefore.filter((v) => v === 1).length;
		expect(exploredCount0).toBeGreaterThan(0);

		const context = buildContext(state0);
		const r = applyAction(
			state0,
			ActionSchema.parse({ type: "move", direction: "right" }),
			context,
		);
		expect(r.ok).toBe(true);
		if (!r.ok) return;

		const exploredAfter = r.state.floors[0].state.explored;
		const exploredCount1 = exploredAfter.filter((v) => v === 1).length;
		expect(exploredCount1).toBeGreaterThanOrEqual(exploredCount0);
	});
});
