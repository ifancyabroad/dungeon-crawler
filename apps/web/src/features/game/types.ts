import type { GameState } from "@app/shared";

/** Optional body for POST /api/game (e.g. seed for debug). */
export interface CreateGameOptions {
	seed?: number;
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
