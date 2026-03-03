/**
 * Phase 0: Invariants — replay equals direct apply; applyAction with context does not regenerate base maps.
 */
import { describe, it, expect, vi } from "vitest";
import {
	ActionSchema,
	applyAction,
	buildGameStateFromPersisted,
	createInitialState,
	computeWalkableMaskForFloor,
	regenerateBaseMaps,
	DEFAULT_FLOOR_CONFIG,
	gameStateToPersisted,
	getHero,
} from "@app/shared";

const SEED = 12345;

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

		const baseLayers = regenerateBaseMaps(SEED, floorConfigs, state0.mapGenVersion);
		const masks = baseLayers.map((base, i) =>
			computeWalkableMaskForFloor(base, fullState0.floors[i]?.state.tileOverrides ?? {}),
		);
		const context = {
			getWalkableMask(fi: number) {
				const m = masks[fi];
				if (m === undefined) throw new Error(`missing mask for floor ${fi}`);
				return m;
			},
		};

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
			const masksReplay = baseLayers.map((base, i) =>
				computeWalkableMaskForFloor(base, replayed.floors[i]?.state.tileOverrides ?? {}),
			);
			const ctxReplay = {
				getWalkableMask(fi: number) {
					const m = masksReplay[fi];
					if (m === undefined) throw new Error(`missing mask for floor ${fi}`);
					return m;
				},
			};
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
		const baseLayers = regenerateBaseMaps(
			SEED,
			state.floors.map((f) => f.config),
			state.mapGenVersion,
		);
		const masks = baseLayers.map((base, i) =>
			computeWalkableMaskForFloor(base, state.floors[i]?.state.tileOverrides ?? {}),
		);
		const context = {
			getWalkableMask(fi: number) {
				const m = masks[fi];
				if (m === undefined) throw new Error(`missing mask for floor ${fi}`);
				return m;
			},
		};

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
});
