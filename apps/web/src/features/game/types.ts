import type { GameState } from "@app/shared";

/** Body for POST /api/game. classId + heroName are required for character creation. */
export interface CreateGameOptions {
	seed?: number;
	classId: string;
	heroName: string;
}

export interface CreateGameResponse {
	gameId: string;
	seed: number;
	state: GameState;
}

export interface CurrentGameResponse {
	gameId: string;
	state: GameState;
}
