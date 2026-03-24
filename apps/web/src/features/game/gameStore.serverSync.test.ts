import {
	applyActionWithDerivedContext,
	createInitialState,
	DEFAULT_FLOOR_CONFIG,
	DEFAULT_HERO_INIT,
	getHero,
	type GameState,
} from "@app/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { setGameSocket, useGameStore } from "./gameStore";

function makeInitialState(): GameState {
	return createInitialState(42, [DEFAULT_FLOOR_CONFIG], DEFAULT_HERO_INIT);
}

const DIRECTIONS = ["right", "down", "left", "up"] as const;

function findValidMoveDirection(state: GameState) {
	for (const direction of DIRECTIONS) {
		const result = applyActionWithDerivedContext(state, { type: "move", direction });
		if (result.ok) return direction;
	}
	throw new Error("No valid move found from initial state");
}

function resetStore() {
	setGameSocket(null);
	useGameStore.setState({
		gameId: null,
		turn: 0,
		hero: { floorIndex: 0, idx: 0 },
		state: null,
		lastConfirmedState: null,
		pendingActions: [],
		actionInProgress: false,
		lastMoveSentAt: 0,
		lastInvalidMoveAt: 0,
		unsentMoves: [],
		walkableByFloor: null,
		opacityByFloor: null,
	});
}

describe("gameStore server sync", () => {
	beforeEach(() => {
		resetStore();
	});

	it("setStateFromServer updates state and lastConfirmedState", () => {
		const state = makeInitialState();
		useGameStore.getState().setStateFromServer({
			gameId: "g1",
			turn: state.turn,
			state,
		});

		const s = useGameStore.getState();
		expect(s.gameId).toBe("g1");
		expect(s.turn).toBe(0);
		expect(s.state).toEqual(state);
		expect(s.lastConfirmedState).toEqual(state);
		expect(s.hero).toEqual({
			floorIndex: 0,
			idx: getHero(state)!.idx,
		});
	});

	it("setStateFromServer with different gameId always applies", () => {
		const state1 = makeInitialState();
		useGameStore.getState().setStateFromServer({
			gameId: "g1",
			turn: state1.turn,
			state: state1,
		});
		useGameStore.getState().sendAction({ type: "move", direction: "right" });
		useGameStore.getState().sendAction({ type: "move", direction: "right" });

		const state2 = makeInitialState();
		useGameStore.getState().setStateFromServer({
			gameId: "g2",
			turn: state2.turn,
			state: state2,
		});

		const s = useGameStore.getState();
		expect(s.gameId).toBe("g2");
		expect(s.turn).toBe(0);
		expect(s.state).toEqual(state2);
		expect(s.pendingActions).toEqual([]);
		expect(s.unsentMoves).toEqual([]);
	});

	it("revertToConfirmed restores state and returns message when confirmed exists", () => {
		const state = makeInitialState();
		useGameStore.getState().setStateFromServer({
			gameId: "g1",
			turn: state.turn,
			state,
		});
		const direction = findValidMoveDirection(state);
		useGameStore.getState().sendAction({ type: "move", direction });
		expect(useGameStore.getState().turn).toBe(1);

		const message = useGameStore.getState().revertToConfirmed();
		expect(message).not.toBeNull();
		expect(useGameStore.getState().turn).toBe(0);
		expect(useGameStore.getState().state).toEqual(state);
	});

	it("revertToConfirmed returns null when no confirmed state", () => {
		useGameStore.setState({ gameId: "g1", state: makeInitialState(), turn: 0 });
		const message = useGameStore.getState().revertToConfirmed();
		expect(message).toBeNull();
	});

	it("clearGameId clears state, lastConfirmedState and pendingActions", () => {
		const state = makeInitialState();
		useGameStore.getState().setStateFromServer({
			gameId: "g1",
			turn: state.turn,
			state,
		});
		useGameStore.getState().clearGameId();
		const s = useGameStore.getState();
		expect(s.gameId).toBeNull();
		expect(s.state).toBeNull();
		expect(s.lastConfirmedState).toBeNull();
		expect(s.pendingActions).toEqual([]);
	});
});
