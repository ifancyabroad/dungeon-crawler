import { create } from "zustand";
import { applyActionWithDerivedContext, getHero, type GameState } from "@app/shared";
import type { Action } from "@app/shared";

const GAME_ID_KEY = "dungeon_gameId";

/** Action applied locally but not yet sent (e.g. socket was null). */
interface PendingAction {
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
	/**
	 * True while the current action's feedback is playing (e.g. move tween, attack animation).
	 * Blocks sendAction until the scene/UI calls setActionInProgress(false).
	 * Scalable: each action type (move, attack, use item, etc.) signals completion when its feedback ends.
	 */
	actionInProgress: boolean;
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
	actionInProgress: false,
};

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
		const { turn: currentTurn, pendingActions, lastConfirmedState } = get();
		const confirmedTurn = lastConfirmedState?.turn ?? -1;
		if (payload.turn >= confirmedTurn) set({ lastConfirmedState: payload.state });

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
			if (gameSocketRef) {
				for (const { action, expectedTurn } of pendingActions) {
					gameSocketRef.emit("action", {
						gameId: payload.gameId,
						action,
						expectedTurn,
					});
				}
			}
			set({ pendingActions: [] });
			return;
		}

		// Only update display when server is ahead or equal (avoid snap-back when we're ahead).
		if (payload.turn >= currentTurn) {
			applyStateUpdate(set, payload);
		}
	},

	setGameId: (id) => set({ gameId: id }),

	setActionInProgress: (active) => set({ actionInProgress: active }),

	sendAction: (action) => {
		const { gameId, state, actionInProgress } = get();
		if (!gameId) return;
		if (actionInProgress) return;
		if (!state) {
			if (gameSocketRef)
				gameSocketRef.emit("action", { gameId, action, expectedTurn: get().turn });
			return;
		}
		const result = applyActionWithDerivedContext(state, action);
		if (!result.ok) return;
		applyStateUpdate(set, {
			gameId,
			turn: result.state.turn,
			state: result.state,
		});
		if (gameSocketRef) {
			gameSocketRef.emit("action", {
				gameId,
				action,
				expectedTurn: state.turn,
			});
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
		set({ pendingActions: [] });
		return "Connection or validation issue – reverted to last saved position.";
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
			actionInProgress: false,
		});
	},
}));

let gameSocketRef: { emit: (ev: string, pl: unknown) => void } | null = null;

/** Set socket reference so sendAction can emit. Called from useGameSocket. */
export function setGameSocket(socket: { emit: (ev: string, pl: unknown) => void } | null): void {
	gameSocketRef = socket;
}
