import { create } from "zustand";
import {
	applyAction,
	applyActionWithDerivedContext,
	computeOpacityMask,
	computeWalkableMaskForFloor,
	createActionContext,
	getHero,
	regenerateBaseMaps,
	type Action,
	type GameEvent,
	type GameState,
} from "@app/shared";
import { vaults } from "@app/content";

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

const getMinInvalidRetry = () =>
	typeof process !== "undefined" && process.env?.NODE_ENV === "test"
		? 0
		: MIN_INVALID_MOVE_RETRY_MS;

const getNow = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** Action buffered client-side, not yet confirmed by the server. */
interface BufferedAction {
	action: Action;
	expectedTurn: number;
}

/** Maximum combat log entries retained. */
const MAX_COMBAT_LOG = 50;

/** Extracted level_up event payload for the modal. */
export interface LevelUpEvent {
	newLevel: number;
	hpGained: number;
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
	pendingActions: BufferedAction[];
	/** Moves applied for display but not yet sent (at in-flight cap). Flushed when we receive state. */
	unsentMoves: BufferedAction[];
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
	/** Latest combat events from the most recent action. */
	events: GameEvent[];
	/** Whether the hero is currently alive. Derived from state. */
	heroAlive: boolean;
	/** Accumulated combat log entries for display. Capped at MAX_COMBAT_LOG. */
	combatLog: GameEvent[];
	/** Turn number of the last optimistic event batch we logged. Used to avoid double-logging when server confirms. */
	lastOptimisticEventTurn: number;
	/** Pending level-up events to display in sequence. Dismissed one at a time. */
	levelUpEvents: LevelUpEvent[];
}

interface GameStoreActions {
	/** Set state from server (join or state event). Updates lastConfirmedState; only updates display when server.turn >= current turn (avoids snap-back). */
	setStateFromServer: (payload: {
		gameId: string;
		turn: number;
		state: GameState;
		events?: GameEvent[];
	}) => void;
	setGameId: (id: string | null) => void;
	/** Send a player action (move or attack). Direction-based: client determines action type. */
	sendAction: (action: Action) => void;
	/** Called by the scene when an action's feedback starts (true) or completes (false). Blocks sendAction while true. */
	setActionInProgress: (active: boolean) => void;
	/** Revert to last confirmed state and return error reason for UI. */
	revertToConfirmed: () => string | null;
	getStoredGameId: () => string | null;
	storeGameId: (id: string) => void;
	clearGameId: () => void;
	/** Dismiss the first pending level-up event. */
	dismissLevelUp: () => void;
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
	events: [],
	heroAlive: true,
	combatLog: [],
	lastOptimisticEventTurn: -1,
	levelUpEvents: [],
};

function heroFromState(state: GameState): { floorIndex: number; idx: number } {
	const hero = getHero(state);
	if (!hero) return { floorIndex: 0, idx: 0 };
	return { floorIndex: state.heroFloorIndex, idx: hero.idx };
}

function extractLevelUpEvents(events: GameEvent[]): LevelUpEvent[] {
	return events
		.filter((e): e is Extract<GameEvent, { type: "level_up" }> => e.type === "level_up")
		.map((e) => ({ newLevel: e.newLevel, hpGained: e.hpGained }));
}

function applyStateUpdate(
	set: (partial: Partial<GameStoreState>) => void,
	payload: { gameId: string; turn: number; state: GameState },
) {
	const state = payload.state;
	const hero = getHero(state);
	set({
		gameId: payload.gameId,
		turn: payload.turn,
		hero: heroFromState(state),
		state,
		heroAlive: hero?.alive ?? false,
	});
}

/** Compute and return walkable + opacity masks for all floors. Static for the session lifetime. */
function buildMasks(state: GameState): Pick<GameStoreState, "walkableByFloor" | "opacityByFloor"> {
	const baseLayers = regenerateBaseMaps(
		state.seed,
		state.floors.map((f) => f.config),
		state.mapGenVersion,
		{ vaultDefs: vaults },
	);
	return {
		walkableByFloor: baseLayers.map((base, i) =>
			computeWalkableMaskForFloor(base, state.floors[i]?.state.tileOverrides ?? {}),
		),
		opacityByFloor: baseLayers.map((base) =>
			computeOpacityMask(base.wall, base.width, base.height),
		),
	};
}

function canSendAction(
	s: Pick<GameStoreState, "actionInProgress" | "lastMoveSentAt" | "lastInvalidMoveAt">,
): boolean {
	if (s.actionInProgress) return false;
	const now = getNow();
	if (s.lastMoveSentAt > 0 && now - s.lastMoveSentAt < getMinMoveInterval()) return false;
	if (s.lastInvalidMoveAt > 0 && now - s.lastInvalidMoveAt < getMinInvalidRetry()) return false;
	return true;
}

export const useGameStore = create<GameStore>((set, get) => ({
	...initialState,

	setStateFromServer: (payload) => {
		const {
			gameId: currentGameId,
			turn: currentTurn,
			pendingActions,
			lastConfirmedState,
			combatLog,
			lastOptimisticEventTurn,
		} = get();
		const confirmedTurn = lastConfirmedState?.turn ?? -1;
		if (payload.turn >= confirmedTurn) set({ lastConfirmedState: payload.state });

		const incomingEvents = payload.events ?? [];
		// Only append server events if we didn't already log them optimistically for this turn
		const alreadyLogged = lastOptimisticEventTurn === payload.turn;
		if (incomingEvents.length > 0 && !alreadyLogged) {
			const newLog = [...combatLog, ...incomingEvents].slice(-MAX_COMBAT_LOG);
			set({ events: incomingEvents, combatLog: newLog });
			const newLevelUps = extractLevelUpEvents(incomingEvents);
			if (newLevelUps.length > 0) {
				set({ levelUpEvents: [...get().levelUpEvents, ...newLevelUps] });
			}
		}

		// New game (e.g. debug "Generate map"): always apply so scene restart sees new state.
		// Masks are static for the session lifetime; also initialised in the normal branch below
		// when gameId was pre-loaded from localStorage (page refresh).
		if (payload.gameId !== currentGameId) {
			applyStateUpdate(set, payload);
			set({
				...buildMasks(payload.state),
				pendingActions: [],
				unsentMoves: [],
				combatLog: [],
				events: [],
				lastOptimisticEventTurn: -1,
			});
			return;
		}

		if (pendingActions.length > 0) {
			// Replay pending on top of server state, update display, then send all and clear queue.
			// Use cached masks when available (normal case); fall back to derived context only if
			// masks haven't been initialised yet (should not happen in practice).
			const { walkableByFloor: wb, opacityByFloor: ob } = get();
			const replayCtx = wb && ob ? createActionContext(wb, ob) : null;
			let nextState = payload.state;
			for (const { action } of pendingActions) {
				const result = replayCtx
					? applyAction(nextState, action, replayCtx)
					: applyActionWithDerivedContext(nextState, action);
				if (!result.ok) break;
				nextState = result.state;
			}
			applyStateUpdate(set, {
				gameId: payload.gameId,
				turn: nextState.turn,
				state: nextState,
			});
			// Masks are static for this game session; no recomputation needed on state replay.
			set({ pendingActions: [] });
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
		// Masks are static for this game session; no recomputation needed on routine state updates.
		if (payload.turn >= currentTurn) {
			applyStateUpdate(set, payload);
		}

		// On page refresh the gameId is pre-loaded from localStorage before the socket responds,
		// so this branch is taken instead of the new-game branch — meaning masks were never
		// computed. Initialise them now if still absent so sendAction uses applyAction (fast)
		// rather than applyActionWithDerivedContext (regenerates all maps on every keypress).
		if (get().walkableByFloor == null) {
			const s = get().state;
			if (s) set(buildMasks(s));
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
			set({
				unsentMoves: g.unsentMoves.slice(1),
				lastMoveSentAt: getNow(),
				lastInvalidMoveAt: 0,
			});
			g = get();
		}
	},

	setGameId: (id) => set({ gameId: id }),

	setActionInProgress: (active) => {
		set({ actionInProgress: active });
	},

	sendAction: (action) => {
		const {
			gameId,
			state,
			turn,
			lastConfirmedState,
			unsentMoves,
			walkableByFloor,
			opacityByFloor,
		} = get();
		if (!gameId) return;
		if (!canSendAction(get())) return;
		if (!state) {
			if (gameSocketRef)
				gameSocketRef.emit("action", { gameId, action, expectedTurn: get().turn });
			return;
		}
		const confirmedTurn = lastConfirmedState?.turn ?? turn;

		const hasCachedMasks =
			walkableByFloor != null &&
			walkableByFloor[state.heroFloorIndex] != null &&
			opacityByFloor != null &&
			opacityByFloor[state.heroFloorIndex] != null;
		const result = hasCachedMasks
			? applyAction(state, action, createActionContext(walkableByFloor!, opacityByFloor!))
			: applyActionWithDerivedContext(state, action);
		if (!result.ok) {
			set({ lastInvalidMoveAt: getNow() });
			return;
		}

		// Update events from local apply; record the resulting turn so we skip server duplicates
		if (result.events.length > 0) {
			const currentLog = get().combatLog;
			const newLog = [...currentLog, ...result.events].slice(-MAX_COMBAT_LOG);
			set({
				events: result.events,
				combatLog: newLog,
				lastOptimisticEventTurn: result.state.turn,
			});
			const newLevelUps = extractLevelUpEvents(result.events);
			if (newLevelUps.length > 0) {
				set({ levelUpEvents: [...get().levelUpEvents, ...newLevelUps] });
			}
		}

		applyStateUpdate(set, {
			gameId,
			turn: result.state.turn,
			state: result.state,
		});

		const inFlightAfterApply = result.state.turn - confirmedTurn - unsentMoves.length;
		if (gameSocketRef) {
			if (inFlightAfterApply < MAX_MOVES_IN_FLIGHT) {
				gameSocketRef.emit("action", { gameId, action, expectedTurn: state.turn });
				set({ lastMoveSentAt: getNow(), lastInvalidMoveAt: 0 });
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
		// Masks are static for this game session; no recomputation needed on rollback.
		set({
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
			events: [],
			heroAlive: true,
			combatLog: [],
			lastOptimisticEventTurn: -1,
			levelUpEvents: [],
		});
	},

	dismissLevelUp: () => {
		const { levelUpEvents } = get();
		set({ levelUpEvents: levelUpEvents.slice(1) });
	},
}));

let gameSocketRef: { emit: (ev: string, pl: unknown) => void } | null = null;

/** Set socket reference so sendAction can emit. Called from useGameSocket. */
export function setGameSocket(socket: { emit: (ev: string, pl: unknown) => void } | null): void {
	gameSocketRef = socket;
}
