import { describe, expect, it, vi } from "vitest";
import type { SyncState } from "./types";

vi.mock("phaser", () => ({
	default: {
		Math: {
			Easing: {
				Sine: { Out: "out" },
			},
		},
	},
}));

import { onStoreUpdate } from "./turnUpdatePipeline";

function makeDeps() {
	return {
		mapWidth: 10,
		player: {
			scene: { tweens: { add: vi.fn() } },
			setAlpha: vi.fn(),
		} as never,
		getPlayerTilePos: vi.fn(() => ({ x: 1, y: 1 })),
		setPlayerTilePos: vi.fn(),
		triggerFloorTransition: vi.fn(),
		syncHeroToStore: vi.fn(),
		applyFogOfWar: vi.fn(),
		dispatchFxAndSync: vi.fn(),
		skillAnimController: null,
	};
}

function makeSyncState(): SyncState {
	return {
		lastSyncedIdx: 0,
		lastSyncedTurn: 0,
		lastFloorIndex: 0,
		lastDispatchedEventTurn: -1,
	};
}

describe("onStoreUpdate", () => {
	it("handles floor transition when heroFloorIndex changes", () => {
		const deps = makeDeps();
		const sync = makeSyncState();
		const storeState = {
			state: {
				heroFloorIndex: 1,
				floors: [{ state: { exitIdx: 5 } }, { state: { actorsById: {}, explored: [] } }],
			},
			hero: { idx: 0 },
			events: [],
			lastOptimisticEventTurn: -1,
		} as never;

		onStoreUpdate(storeState, sync, deps);
		expect(deps.triggerFloorTransition).toHaveBeenCalledTimes(1);
		expect(sync.lastFloorIndex).toBe(1);
	});

	it("dispatches fresh turn events and syncs moved hero", () => {
		const deps = makeDeps();
		const sync = makeSyncState();
		const events = [{ type: "damage" }];
		const gameState = {
			turn: 1,
			heroFloorIndex: 0,
			heroId: "hero",
			floors: [{ state: { explored: [1, 0], actorsById: { hero: { activeEffects: [] } } } }],
		};
		const storeState = {
			state: gameState,
			hero: { idx: 8 },
			events,
			lastOptimisticEventTurn: 1,
		} as unknown as Parameters<typeof onStoreUpdate>[0];

		onStoreUpdate(storeState, sync, deps);
		expect(deps.syncHeroToStore).toHaveBeenCalledWith(8);
		expect(deps.applyFogOfWar).toHaveBeenCalledTimes(1);
		expect(deps.dispatchFxAndSync).toHaveBeenCalledWith(
			events,
			gameState,
			gameState.floors[0].state,
		);
		expect(sync.lastSyncedTurn).toBe(1);
	});

	it("syncs hero on turn-unchanged correction", () => {
		const deps = makeDeps();
		const sync = makeSyncState();
		sync.lastSyncedIdx = 2;
		const storeState = {
			state: { turn: 0, heroFloorIndex: 0 },
			hero: { idx: 9 },
			events: [],
			lastOptimisticEventTurn: -1,
		} as never;

		onStoreUpdate(storeState, sync, deps);
		expect(deps.syncHeroToStore).toHaveBeenCalledWith(9);
	});
});
