import {
	applyActionWithDerivedContext,
	createInitialState,
	DEFAULT_FLOOR_CONFIG,
	DEFAULT_HERO_INIT,
	getHero,
	type GameState,
} from "@app/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setGameSocket, useGameStore } from "./gameStore";

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

describe("gameStore actions", () => {
	beforeEach(() => {
		resetStore();
	});

	it("sendAction applies optimistically and emits when socket is set", () => {
		const state = makeInitialState();
		const initialIdx = getHero(state)!.idx;
		useGameStore.getState().setStateFromServer({ gameId: "g1", turn: state.turn, state });

		const emit = vi.fn();
		setGameSocket({ emit });

		const direction = findValidMoveDirection(state);
		useGameStore.getState().sendAction({ type: "move", direction });

		const s = useGameStore.getState();
		expect(s.turn).toBe(1);
		expect(s.state).not.toBeNull();
		expect(getHero(s.state!)!.idx).not.toBe(initialIdx);
		expect(emit).toHaveBeenCalledWith("action", {
			gameId: "g1",
			action: { type: "move", direction },
			expectedTurn: 0,
		});
	});

	it("sendAction applies optimistically and queues when no socket", () => {
		const state = makeInitialState();
		useGameStore.getState().setStateFromServer({ gameId: "g1", turn: state.turn, state });
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

	it("sendAction without state still emits when socket set", () => {
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

	it("sendAction does nothing when actionInProgress is true", () => {
		const state = makeInitialState();
		useGameStore.getState().setStateFromServer({ gameId: "g1", turn: state.turn, state });
		useGameStore.getState().setActionInProgress(true);

		const emit = vi.fn();
		setGameSocket({ emit });
		useGameStore.getState().sendAction({ type: "move", direction: "up" });
		expect(useGameStore.getState().turn).toBe(0);
		expect(emit).not.toHaveBeenCalled();
	});

	it("server behind local optimistic state does not snap back", () => {
		const state = makeInitialState();
		useGameStore.getState().setStateFromServer({ gameId: "g1", turn: state.turn, state });
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

	it("setStateFromServer replays queued actions and flushes queue", () => {
		const state = makeInitialState();
		useGameStore.getState().setStateFromServer({ gameId: "g1", turn: state.turn, state });

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
		useGameStore.getState().setStateFromServer({ gameId: "g1", turn: 0, state });

		expect(useGameStore.getState().turn).toBe(2);
		expect(useGameStore.getState().pendingActions).toHaveLength(0);
		expect(emit).toHaveBeenCalledTimes(2);
	});
});
