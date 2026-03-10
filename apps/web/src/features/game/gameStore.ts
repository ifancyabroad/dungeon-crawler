import { create } from "zustand";
import {
	applyAction,
	applyActionWithDerivedContext,
	computeOpacityMask,
	computeWalkableMaskForFloor,
	createActionContext,
	getHero,
	regenerateBaseMaps,
	type GameState,
} from "@app/shared";
import type { Action } from "@app/shared";

const GAME_ID_KEY = "dungeon_gameId";

/** Max move actions sent without server confirmation. Prevents hold-key from flooding and long freezes. */
const MAX_MOVES_IN_FLIGHT = 8;
/** Min ms between sending move actions. Throttles key-repeat so we don't flood the server. */
const MIN_MOVE_SEND_INTERVAL_MS = 30;
/** Throttle retries after invalid move (blocked/out of bounds); applyActionWithDerivedContext is expensive. */
const MIN_INVALID_MOVE_RETRY_MS = 200;
const getMinMoveInterval = () =>
	typeof process !== "undefined" && process.env?.NODE_ENV === "test"
		? 0
		: MIN_MOVE_SEND_INTERVAL_MS;

/** Action applied locally but not yet sent (e.g. socket was null). */
interface PendingAction {
	action: Action;
	expectedTurn: number;
}

/** Move applied for display but not yet sent (we were at in-flight cap). Sent when server catches up. */
interface UnsentMove {
	action: Action;
	expectedTurn: number;
}

interface GameStoreState {
	gameId: string | null;
	turn: number;
	/** Hero position: floor index + tile idx. Convert to x,y/pixels only in Phaser. */
	hero: { floorIndex: number; idx: number };
	/** Full state from server (for Phaser and map). Derived: turn, hero. */
	state: GameState | null;
	/** Last state received from server; used for rollback on error. */
	lastConfirmedState: GameState | null;
	/** Actions applied locally but not yet sent (socket was null). Flushed when we receive state. */
	pendingActions: PendingAction[];
	/** Moves applied for display but not yet sent (at in-flight cap). Flushed when we receive state. */
	unsentMoves: UnsentMove[];
	/**
	 * True while the current action's feedback is playing (e.g. move tween, attack animation).
	 * Blocks sendAction until the scene/UI calls setActionInProgress(false).
	 * Scalable: each action type (move, attack, use item, etc.) signals completion when its feedback ends.
	 */
	actionInProgress: boolean;
	/** Timestamp when we last sent a move (for rate-limiting key-repeat). 0 = never. */
	lastMoveSentAt: number;
	/** Timestamp when we last tried an invalid move (blocked/out of bounds). Used to throttle retries. 0 = never. */
	lastInvalidMoveAt: number;
	/** Cached walkability masks per floor (1 = walkable). Set when we receive state from server or revert; used for O(1) apply. */
	walkableByFloor: Uint8Array[] | null;
	/** Cached opacity masks per floor (1 = blocks LoS). Used for visibility computation in applyAction. */
	opacityByFloor: Uint8Array[] | null;
}

interface GameStoreActions {
	/** Set state from server (join or state event). Updates lastConfirmedState; only updates display when server.turn >= current turn (avoids snap-back). */
	setStateFromServer: (payload: { gameId: string; turn: number; state: GameState }) => void;
	setGameId: (id: string | null) => void;
	sendAction: (action: { type: "move"; direction: "up" | "down" | "left" | "right" }) => void;
	/** Called by the scene when an action's feedback starts (true) or completes (false). Blocks sendAction while true. */
	setActionInProgress: (active: boolean) => void;
	/** Revert to last confirmed state and return error reason for UI. */
	revertToConfirmed: () => string | null;
	getStoredGameId: () => string | null;
	storeGameId: (id: string) => void;
	clearGameId: () => void;
}

export type GameStore = GameStoreState & GameStoreActions;

const initialState: GameStoreState = {
	gameId: null,
	turn: 0,
	hero: { floorIndex: 0, idx: 0 },
	state: null,
	lastConfirmedState: null,
	pendingActions: [],
	unsentMoves: [],
	actionInProgress: false,
	lastMoveSentAt: 0,
	lastInvalidMoveAt: 0,
	walkableByFloor: null,
	opacityByFloor: null,
};

function computeFloorMasks(state: GameState): { walkable: Uint8Array[]; opacity: Uint8Array[] } {
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
	return { walkable, opacity };
}

function heroFromState(state: GameState): { floorIndex: number; idx: number } {
	const hero = getHero(state);
	if (!hero) return { floorIndex: 0, idx: 0 };
	return { floorIndex: state.heroFloorIndex, idx: hero.idx };
}

function applyStateUpdate(
	set: (partial: Partial<GameStoreState>) => void,
	payload: { gameId: string; turn: number; state: GameState },
) {
	const state = payload.state;
	set({
		gameId: payload.gameId,
		turn: payload.turn,
		hero: heroFromState(state),
		state,
	});
}

export const useGameStore = create<GameStore>((set, get) => ({
	...initialState,

	setStateFromServer: (payload) => {
		const {
			gameId: currentGameId,
			turn: currentTurn,
			pendingActions,
			lastConfirmedState,
		} = get();
		const confirmedTurn = lastConfirmedState?.turn ?? -1;
		if (payload.turn >= confirmedTurn) set({ lastConfirmedState: payload.state });

		// New game (e.g. debug "Generate map"): always apply so scene restart sees new state.
		if (payload.gameId !== currentGameId) {
			applyStateUpdate(set, payload);
			const masks = computeFloorMasks(payload.state);
			set({
				walkableByFloor: masks.walkable,
				opacityByFloor: masks.opacity,
				pendingActions: [],
				unsentMoves: [],
			});
			return;
		}

		if (pendingActions.length > 0) {
			// Replay pending on top of server state, update display, then send all and clear queue.
			let nextState = payload.state;
			for (const { action } of pendingActions) {
				const result = applyActionWithDerivedContext(nextState, action);
				if (!result.ok) break;
				nextState = result.state;
			}
			applyStateUpdate(set, {
				gameId: payload.gameId,
				turn: nextState.turn,
				state: nextState,
			});
			const nextMasks = computeFloorMasks(nextState);
			set({
				walkableByFloor: nextMasks.walkable,
				opacityByFloor: nextMasks.opacity,
				pendingActions: [],
			});
			if (gameSocketRef) {
				for (const { action, expectedTurn } of pendingActions) {
					gameSocketRef.emit("action", {
						gameId: payload.gameId,
						action,
						expectedTurn,
					});
				}
			}
			return;
		}

		// Only update display when server is ahead or equal (avoid snap-back when we're ahead).
		if (payload.turn >= currentTurn) {
			applyStateUpdate(set, payload);
			const payloadMasks = computeFloorMasks(payload.state);
			set({ walkableByFloor: payloadMasks.walkable, opacityByFloor: payloadMasks.opacity });
		}

		// Flush unsent moves: server caught up, send next queued action if server is ready for it.
		if (!gameSocketRef) return;
		let g = get();
		while (
			g.unsentMoves.length > 0 &&
			g.unsentMoves[0].expectedTurn === (g.lastConfirmedState?.turn ?? -1) &&
			g.turn - (g.lastConfirmedState?.turn ?? g.turn) - g.unsentMoves.length <
				MAX_MOVES_IN_FLIGHT
		) {
			const { action, expectedTurn } = g.unsentMoves[0];
			gameSocketRef.emit("action", { gameId: g.gameId, action, expectedTurn });
			const now = typeof performance !== "undefined" ? performance.now() : Date.now();
			set({
				unsentMoves: g.unsentMoves.slice(1),
				lastMoveSentAt: now,
				lastInvalidMoveAt: 0,
			});
			g = get();
		}
	},

	setGameId: (id) => set({ gameId: id }),

	setActionInProgress: (active) => set({ actionInProgress: active }),

	sendAction: (action) => {
		const {
			gameId,
			state,
			actionInProgress,
			turn,
			lastConfirmedState,
			lastMoveSentAt,
			lastInvalidMoveAt,
			unsentMoves,
			walkableByFloor,
			opacityByFloor,
		} = get();
		if (!gameId) return;
		if (actionInProgress) return;
		if (!state) {
			if (gameSocketRef)
				gameSocketRef.emit("action", { gameId, action, expectedTurn: get().turn });
			return;
		}
		const confirmedTurn = lastConfirmedState?.turn ?? turn;
		const now = typeof performance !== "undefined" ? performance.now() : Date.now();
		if (lastMoveSentAt > 0 && now - lastMoveSentAt < getMinMoveInterval()) return;
		const minInvalidRetry =
			typeof process !== "undefined" && process.env?.NODE_ENV === "test"
				? 0
				: MIN_INVALID_MOVE_RETRY_MS;
		if (lastInvalidMoveAt > 0 && now - lastInvalidMoveAt < minInvalidRetry) return;

		const hasCachedMasks =
			walkableByFloor != null &&
			walkableByFloor[state.heroFloorIndex] != null &&
			opacityByFloor != null &&
			opacityByFloor[state.heroFloorIndex] != null;
		const result = hasCachedMasks
			? applyAction(state, action, createActionContext(walkableByFloor!, opacityByFloor!))
			: applyActionWithDerivedContext(state, action);
		if (!result.ok) {
			set({ lastInvalidMoveAt: now });
			return;
		}

		// Always apply for display (DCSS-style: character renders in each tile).
		applyStateUpdate(set, {
			gameId,
			turn: result.state.turn,
			state: result.state,
		});

		const inFlightAfterApply = result.state.turn - confirmedTurn - unsentMoves.length;
		if (gameSocketRef) {
			if (inFlightAfterApply < MAX_MOVES_IN_FLIGHT) {
				gameSocketRef.emit("action", { gameId, action, expectedTurn: state.turn });
				set({ lastMoveSentAt: now, lastInvalidMoveAt: 0 });
			} else {
				set({
					unsentMoves: [...unsentMoves, { action, expectedTurn: state.turn }],
				});
			}
		} else {
			set({
				pendingActions: [...get().pendingActions, { action, expectedTurn: state.turn }],
			});
		}
	},

	revertToConfirmed: () => {
		const { lastConfirmedState: confirmed, gameId } = get();
		if (!confirmed || !gameId) return null;
		applyStateUpdate(set, {
			gameId,
			turn: confirmed.turn,
			state: confirmed,
		});
		const revertMasks = computeFloorMasks(confirmed);
		set({
			walkableByFloor: revertMasks.walkable,
			opacityByFloor: revertMasks.opacity,
			pendingActions: [],
			unsentMoves: [],
			lastMoveSentAt: 0,
			lastInvalidMoveAt: 0,
		});
		return "Position synced with server.";
	},

	getStoredGameId: () => {
		if (typeof window === "undefined") return null;
		return localStorage.getItem(GAME_ID_KEY);
	},

	storeGameId: (id) => {
		if (typeof window !== "undefined") localStorage.setItem(GAME_ID_KEY, id);
		set({ gameId: id });
	},

	clearGameId: () => {
		try {
			if (typeof window !== "undefined" && typeof localStorage?.removeItem === "function")
				localStorage.removeItem(GAME_ID_KEY);
		} catch {
			// ignore (e.g. test env)
		}
		set({
			gameId: null,
			state: null,
			lastConfirmedState: null,
			pendingActions: [],
			unsentMoves: [],
			actionInProgress: false,
			lastMoveSentAt: 0,
			lastInvalidMoveAt: 0,
			walkableByFloor: null,
			opacityByFloor: null,
		});
	},
}));

let gameSocketRef: { emit: (ev: string, pl: unknown) => void } | null = null;

/** Set socket reference so sendAction can emit. Called from useGameSocket. */
export function setGameSocket(socket: { emit: (ev: string, pl: unknown) => void } | null): void {
	gameSocketRef = socket;
}
