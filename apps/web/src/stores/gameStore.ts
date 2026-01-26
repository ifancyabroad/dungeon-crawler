import { create } from "zustand";

/**
 * Game state store using Zustand.
 *
 * This store can be accessed from both React components (via hooks) and
 * Phaser scenes (via getState/setState). This solves the React-Phaser
 * communication problem elegantly.
 *
 * React usage:
 *   const score = useGameStore((s) => s.score);
 *   const { addPoints } = useGameStore();
 *
 * Phaser usage (no hooks):
 *   useGameStore.getState().addPoints(10);
 *   const currentScore = useGameStore.getState().score;
 */

const GAME_DURATION = 30; // seconds

interface GameState {
	// State
	score: number;
	isPlaying: boolean;
	timeLeft: number;
	playerName: string;

	// Actions
	addPoints: (points: number) => void;
	startGame: () => void;
	endGame: () => void;
	resetGame: () => void;
	setTimeLeft: (time: number) => void;
	setPlayerName: (name: string) => void;
}

export const useGameStore = create<GameState>((set) => ({
	// Initial state
	score: 0,
	isPlaying: false,
	timeLeft: GAME_DURATION,
	playerName: "",

	// Actions
	addPoints: (points) => set((state) => ({ score: state.score + points })),
	startGame: () => set({ isPlaying: true, score: 0, timeLeft: GAME_DURATION }),
	endGame: () => set({ isPlaying: false }),
	resetGame: () => set({ score: 0, isPlaying: false, timeLeft: GAME_DURATION, playerName: "" }),
	setTimeLeft: (time) => set({ timeLeft: time }),
	setPlayerName: (name) => set({ playerName: name }),
}));

export { GAME_DURATION };
