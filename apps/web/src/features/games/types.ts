import type { GameState } from "@app/shared";

export interface CreateGameResponse {
	gameId: string;
	seed: number;
	state: GameState;
}

export interface CurrentGameResponse {
	gameId: string;
	state: GameState;
}
