import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore, GAME_DURATION } from "./gameStore";

describe("gameStore", () => {
	beforeEach(() => {
		// Reset store to initial state before each test
		useGameStore.getState().resetGame();
	});

	it("should have initial state", () => {
		const state = useGameStore.getState();
		expect(state.score).toBe(0);
		expect(state.isPlaying).toBe(false);
		expect(state.timeLeft).toBe(GAME_DURATION);
		expect(state.playerName).toBe("");
	});

	it("should add points", () => {
		useGameStore.getState().addPoints(10);
		expect(useGameStore.getState().score).toBe(10);

		useGameStore.getState().addPoints(5);
		expect(useGameStore.getState().score).toBe(15);
	});

	it("should start game and reset score and timer", () => {
		useGameStore.getState().addPoints(50);
		useGameStore.getState().setTimeLeft(10);
		useGameStore.getState().startGame();

		const state = useGameStore.getState();
		expect(state.isPlaying).toBe(true);
		expect(state.score).toBe(0);
		expect(state.timeLeft).toBe(GAME_DURATION);
	});

	it("should end game", () => {
		useGameStore.getState().startGame();
		useGameStore.getState().addPoints(100);
		useGameStore.getState().endGame();

		const state = useGameStore.getState();
		expect(state.isPlaying).toBe(false);
		expect(state.score).toBe(100); // Score preserved after game ends
	});

	it("should reset game completely", () => {
		useGameStore.getState().startGame();
		useGameStore.getState().addPoints(100);
		useGameStore.getState().setPlayerName("TestPlayer");
		useGameStore.getState().resetGame();

		const state = useGameStore.getState();
		expect(state.isPlaying).toBe(false);
		expect(state.score).toBe(0);
		expect(state.timeLeft).toBe(GAME_DURATION);
		expect(state.playerName).toBe("");
	});

	it("should set time left", () => {
		useGameStore.getState().setTimeLeft(15);
		expect(useGameStore.getState().timeLeft).toBe(15);
	});

	it("should set player name", () => {
		useGameStore.getState().setPlayerName("Alice");
		expect(useGameStore.getState().playerName).toBe("Alice");
	});
});
