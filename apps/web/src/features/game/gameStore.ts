import { create } from "zustand";
import type { GameState } from "@app/shared";

const GAME_ID_KEY = "dungeon_gameId";

interface GameStoreState {
	gameId: string | null;
	turn: number;
	hero: { floorIndex: number; x: number; y: number };
	/** Full state from server (for Phaser and map). Derived: turn, hero. */
	state: GameState | null;
}

interface GameStoreActions {
	setState: (payload: { gameId: string; turn: number; state: GameState }) => void;
	setGameId: (id: string | null) => void;
	sendAction: (action: { type: "move"; direction: "up" | "down" | "left" | "right" }) => void;
	getStoredGameId: () => string | null;
	storeGameId: (id: string) => void;
	clearGameId: () => void;
}

export type GameStore = GameStoreState & GameStoreActions;

const initialState: GameStoreState = {
	gameId: null,
	turn: 0,
	hero: { floorIndex: 0, x: 0, y: 0 },
	state: null,
};

export const useGameStore = create<GameStore>((set, get) => ({
	...initialState,

	setState: (payload) => {
		const state = payload.state;
		set({
			gameId: payload.gameId,
			turn: payload.turn,
			hero: state.hero,
			state,
		});
	},

	setGameId: (id) => set({ gameId: id }),

	sendAction: (action) => {
		const { gameId, turn } = get();
		if (gameId && gameSocketRef)
			gameSocketRef.emit("action", { gameId, action, expectedTurn: turn });
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
		if (typeof window !== "undefined") localStorage.removeItem(GAME_ID_KEY);
		set({ gameId: null });
	},
}));

let gameSocketRef: { emit: (ev: string, pl: unknown) => void } | null = null;

/** Set socket reference so sendAction can emit. Called from useGameSocket. */
export function setGameSocket(socket: { emit: (ev: string, pl: unknown) => void } | null): void {
	gameSocketRef = socket;
}
