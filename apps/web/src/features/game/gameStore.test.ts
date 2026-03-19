import {
	applyActionWithDerivedContext,
	createInitialState,
	DEFAULT_FLOOR_CONFIG,
	DEFAULT_HERO_INIT,
	getHero,
	type GameState,
} from "@app/shared";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useGameStore, setGameSocket } from "./gameStore";

function makeInitialState(): GameState {
	return createInitialState(42, [DEFAULT_FLOOR_CONFIG], DEFAULT_HERO_INIT);
}

const DIRECTIONS = ["right", "down", "left", "up"] as const;
type MoveDirection = (typeof DIRECTIONS)[number];

function findValidMoveDirection(state: GameState): MoveDirection {
	for (const direction of DIRECTIONS) {
		const result = applyActionWithDerivedContext(state, { type: "move", direction });
		if (result.ok) return direction;
	}
	throw new Error("No valid move found from initial state");
}

describe("gameStore (optimistic)", () => {
	beforeEach(() => {
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

	it("setStateFromServer with different gameId always applies (e.g. debug Generate map)", () => {
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

	it("sendAction applies optimistically and emits when socket is set", () => {
		const state = makeInitialState();
		const initialIdx = getHero(state)!.idx;
		useGameStore.getState().setStateFromServer({
			gameId: "g1",
			turn: state.turn,
			state,
		});

		const emit = vi.fn();
		setGameSocket({ emit });

		const direction = findValidMoveDirection(state);
		useGameStore.getState().sendAction({ type: "move", direction });

		const s = useGameStore.getState();
		expect(s.turn).toBe(1);
		expect(s.state).not.toBeNull();
		expect(getHero(s.state!)!.idx).not.toBe(initialIdx);
		expect(emit).toHaveBeenCalledTimes(1);
		expect(emit).toHaveBeenCalledWith("action", {
			gameId: "g1",
			action: { type: "move", direction },
			expectedTurn: 0,
		});
	});

	it("two local moves then setStateFromServer does not snap back when server is behind", () => {
		const state = makeInitialState();
		useGameStore.getState().setStateFromServer({
			gameId: "g1",
			turn: state.turn,
			state,
		});

		const emit = vi.fn();
		setGameSocket({ emit });

		const firstDir = findValidMoveDirection(state);
		const firstResult = applyActionWithDerivedContext(state, {
			type: "move",
			direction: firstDir,
		});
		if (!firstResult.ok) throw new Error("expected ok");
		const secondDir = findValidMoveDirection(firstResult.state);

		useGameStore.getState().sendAction({ type: "move", direction: firstDir });
		useGameStore.getState().sendAction({ type: "move", direction: secondDir });

		expect(useGameStore.getState().turn).toBe(2);
		expect(emit).toHaveBeenCalledTimes(2);

		// Server sends state for turn 1 only (behind us). We must not overwrite display.
		const stateAfterOne = createInitialState(42, [DEFAULT_FLOOR_CONFIG], DEFAULT_HERO_INIT);
		const result = applyActionWithDerivedContext(stateAfterOne, {
			type: "move",
			direction: firstDir,
		});
		if (!result.ok) throw new Error("expected ok");
		useGameStore.getState().setStateFromServer({
			gameId: "g1",
			turn: result.state.turn,
			state: result.state,
		});

		const s = useGameStore.getState();
		expect(s.turn).toBe(2);
		expect(s.lastConfirmedState).toEqual(result.state);
	});

	it("revertToConfirmed restores state and returns message when confirmed exists", () => {
		const state = makeInitialState();
		useGameStore.getState().setStateFromServer({
			gameId: "g1",
			turn: state.turn,
			state,
		});

		const emit = vi.fn();
		setGameSocket({ emit });
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

	it("sendAction without state still emits when socket set (no optimistic apply)", () => {
		useGameStore.setState({ gameId: "g1", state: null, turn: 0 });
		const emit = vi.fn();
		setGameSocket({ emit });
		useGameStore.getState().sendAction({ type: "move", direction: "up" });
		expect(emit).toHaveBeenCalledWith("action", {
			gameId: "g1",
			action: { type: "move", direction: "up" },
			expectedTurn: 0,
		});
	});

	it("sendAction does nothing when actionInProgress is true (any action type)", () => {
		const state = makeInitialState();
		useGameStore.getState().setStateFromServer({
			gameId: "g1",
			turn: state.turn,
			state,
		});
		useGameStore.getState().setActionInProgress(true);
		const emit = vi.fn();
		setGameSocket({ emit });
		useGameStore.getState().sendAction({ type: "move", direction: "up" });
		expect(useGameStore.getState().turn).toBe(0);
		expect(emit).not.toHaveBeenCalled();
	});

	it("sendAction applies optimistically and queues when no socket", () => {
		const state = makeInitialState();
		useGameStore.getState().setStateFromServer({
			gameId: "g1",
			turn: state.turn,
			state,
		});
		const direction = findValidMoveDirection(state);
		useGameStore.getState().sendAction({ type: "move", direction });
		const s = useGameStore.getState();
		expect(s.turn).toBe(1);
		expect(s.pendingActions).toHaveLength(1);
		expect(s.pendingActions[0]).toEqual({
			action: { type: "move", direction },
			expectedTurn: 0,
		});
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

	it("setStateFromServer with pending replays and sends then clears queue", () => {
		const state = makeInitialState();
		useGameStore.getState().setStateFromServer({
			gameId: "g1",
			turn: state.turn,
			state,
		});
		const firstDir = findValidMoveDirection(state);
		const firstResult = applyActionWithDerivedContext(state, {
			type: "move",
			direction: firstDir,
		});
		if (!firstResult.ok) throw new Error("expected ok");
		const secondDir = findValidMoveDirection(firstResult.state);

		useGameStore.getState().sendAction({ type: "move", direction: firstDir });
		useGameStore.getState().sendAction({ type: "move", direction: secondDir });
		expect(useGameStore.getState().pendingActions).toHaveLength(2);

		const emit = vi.fn();
		setGameSocket({ emit });
		useGameStore.getState().setStateFromServer({
			gameId: "g1",
			turn: 0,
			state,
		});

		expect(useGameStore.getState().turn).toBe(2);
		expect(useGameStore.getState().pendingActions).toHaveLength(0);
		expect(emit).toHaveBeenCalledTimes(2);
		expect(emit).toHaveBeenNthCalledWith(1, "action", {
			gameId: "g1",
			action: { type: "move", direction: firstDir },
			expectedTurn: 0,
		});
		expect(emit).toHaveBeenNthCalledWith(2, "action", {
			gameId: "g1",
			action: { type: "move", direction: secondDir },
			expectedTurn: 1,
		});
	});
});
