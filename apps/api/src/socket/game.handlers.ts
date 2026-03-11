/**
 * Game socket handlers: join (auth + state load) and action (validate, apply, persist, broadcast).
 * Auth is stored on socket after join; action does not query GameSession.
 * Action log turn = newState.turn (turn after apply).
 */

import type { Server, Socket } from "socket.io";
import { GameSession } from "../models/gameSession.model";
import { Hero } from "../models/hero.model";
import {
	ActionSchema,
	gameStateToPersisted,
	getHero,
	PersistedDynamicStateSchema,
} from "@app/shared";
import type { GameEvent, GameState } from "@app/shared";
import {
	ensureSessionLoaded,
	setSessionState,
	reconstructState,
	persistAction,
	applyAuthoritativeAction,
	StateCorruptError,
} from "../services/gameState.service";
import { withGameLock } from "../services/gameLock";
import { verifyToken } from "../lib/gameToken";
import { env } from "../config/env";

/** Auth context set on socket after successful join. */
interface GameSocketData {
	gameId?: string;
	authed?: boolean;
}

const SNAPSHOT_INTERVAL = 50;

export type GetToken = (socket: Socket) => string | undefined;

async function loadStateOrEmitError(socket: Socket, gameId: string): Promise<GameState | null> {
	try {
		const state = await ensureSessionLoaded(gameId);
		if (!state) {
			socket.emit("error", { reason: "state_not_found" });
			return null;
		}
		return state;
	} catch (err) {
		if (err instanceof StateCorruptError) {
			socket.emit("error", { reason: "state_corrupt" });
			return null;
		}
		throw err;
	}
}

/**
 * Register game-related socket events (join, action) on a connected socket.
 * Call from socket/index after "connection".
 */
export function registerGameHandlers(io: Server, socket: Socket, getToken: GetToken): void {
	socket.on("join", async (payload: { gameId?: string }) => {
		const gameId = payload?.gameId;
		if (!gameId || typeof gameId !== "string") {
			socket.emit("error", { reason: "invalid_join" });
			return;
		}

		const token = getToken(socket);
		if (!token) {
			socket.emit("error", { reason: "unauthorized" });
			return;
		}

		const session = await GameSession.findOne({ gameId }).lean().exec();
		if (!session || !verifyToken(token, session.tokenHash, env.GAME_TOKEN_PEPPER)) {
			socket.emit("error", { reason: "forbidden" });
			return;
		}

		await GameSession.updateOne({ gameId }, { $set: { lastSeenAt: new Date() } }).exec();

		const state = await loadStateOrEmitError(socket, gameId);
		if (!state) return;

		(socket.data as GameSocketData).gameId = gameId;
		(socket.data as GameSocketData).authed = true;
		socket.join(gameId);
		socket.emit("state", { gameId, turn: state.turn, state, events: [] });
	});

	socket.on(
		"action",
		async (payload: { gameId?: string; action?: unknown; expectedTurn?: number }) => {
			const gameId = payload?.gameId;
			const action = payload?.action;
			const expectedTurn = payload?.expectedTurn;
			if (!gameId || typeof gameId !== "string") {
				socket.emit("error", { reason: "invalid_action" });
				return;
			}

			const parsed = ActionSchema.safeParse(action);
			if (!parsed.success) {
				socket.emit("error", { reason: "invalid_action" });
				return;
			}

			if (typeof expectedTurn !== "number") {
				socket.emit("error", { reason: "invalid_action", currentTurn: undefined });
				return;
			}

			const data = socket.data as GameSocketData;
			if (!data.authed || data.gameId !== gameId) {
				socket.emit("error", { reason: "forbidden" });
				return;
			}

			await withGameLock(gameId, async () => {
				const state = await loadStateOrEmitError(socket, gameId);
				if (!state) return;

				if (expectedTurn !== state.turn) {
					socket.emit("state", { gameId, turn: state.turn, state });
					socket.emit("error", { reason: "turn_mismatch", currentTurn: state.turn });
					return;
				}

				let result;
				try {
					result = applyAuthoritativeAction(gameId, state, parsed.data);
				} catch (err) {
					console.error("[action] applyAuthoritativeAction failed:", err);
					socket.emit("state", { gameId, turn: state.turn, state });
					socket.emit("error", { reason: "internal_error" });
					return;
				}
				if (!result.ok) {
					socket.emit("state", { gameId, turn: state.turn, state });
					socket.emit("error", { reason: result.reason });
					return;
				}

				const newTurn = result.state.turn;
				const persistedState = gameStateToPersisted(result.state);
				PersistedDynamicStateSchema.parse(persistedState);

				const persisted = await persistAction(
					gameId,
					newTurn,
					parsed.data,
					persistedState,
					SNAPSHOT_INTERVAL,
				);
				if (!persisted) {
					const current = await reconstructState(gameId);
					if (current) {
						setSessionState(gameId, current);
						io.to(gameId).emit("state", {
							gameId,
							turn: current.turn,
							state: current,
							events: [],
						});
					}
					return;
				}

				setSessionState(gameId, result.state);
				const events: GameEvent[] = result.events;
				io.to(gameId).emit("state", { gameId, turn: newTurn, state: result.state, events });

				// If the hero died, update the Hero model
				const hero = getHero(result.state);
				if (hero && !hero.alive) {
					const session = await GameSession.findOne({ gameId }).lean().exec();
					if (session) {
						await Hero.updateOne(
							{ gameId, status: "active" },
							{ $set: { status: "dead" } },
						).exec();
					}
				}
			});
		},
	);
}
