/**
 * Game socket handlers: join (auth + state load) and action (validate, apply, persist, broadcast).
 * Auth is stored on socket after join; action does not query GameSession.
 * Action log turn = newState.turn (turn after apply).
 */

import type { Server } from "socket.io";
import type { Socket } from "socket.io";
import { GameSession } from "../models/gameSession.model";
import { GameActionLog } from "../models/gameActionLog.model";
import { GameSnapshot } from "../models/gameSnapshot.model";
import { ActionSchema, gameStateToPersisted } from "@app/shared";
import {
	ensureSessionLoaded,
	setSessionState,
	reconstructState,
	applyAuthoritativeAction,
	StateCorruptError,
} from "../services/gameState.service";
import { withGameLock } from "../services/gameLock";
import { verifyToken } from "../lib/gameToken";
import { env } from "../config/env";
import { runTransaction } from "../config/db";
import { PersistedDynamicStateSchema } from "@app/shared";

/** Auth context set on socket after successful join. */
interface GameSocketData {
	gameId?: string;
	authed?: boolean;
}

const SNAPSHOT_INTERVAL = 50;

export type GetToken = (socket: Socket) => string | undefined;

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

		let state;
		try {
			state = await ensureSessionLoaded(gameId);
		} catch (err) {
			if (err instanceof StateCorruptError) {
				socket.emit("error", { reason: "state_corrupt" });
				return;
			}
			throw err;
		}
		if (!state) {
			socket.emit("error", { reason: "state_not_found" });
			return;
		}

		(socket.data as GameSocketData).gameId = gameId;
		(socket.data as GameSocketData).authed = true;
		socket.join(gameId);
		socket.emit("state", { gameId, turn: state.turn, state });
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
				let state;
				try {
					state = await ensureSessionLoaded(gameId);
				} catch (err) {
					if (err instanceof StateCorruptError) {
						socket.emit("error", { reason: "state_corrupt" });
						return;
					}
					throw err;
				}
				if (!state) {
					socket.emit("error", { reason: "state_not_found" });
					return;
				}

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

				try {
					await runTransaction(async (session) => {
						await GameActionLog.create(
							[{ gameId, turn: newTurn, action: parsed.data }],
							{ session },
						);
						if (newTurn % SNAPSHOT_INTERVAL === 0) {
							await GameSnapshot.create(
								[
									{
										gameId,
										turn: newTurn,
										state: persistedState,
										createdAt: new Date(),
									},
								],
								{ session },
							);
							await GameSession.updateOne(
								{ gameId },
								{ $set: { latestSnapshotTurn: newTurn, lastSeenAt: new Date() } },
								{ session },
							);
						} else {
							await GameSession.updateOne(
								{ gameId },
								{ $set: { lastSeenAt: new Date() } },
								{ session },
							);
						}
					});
				} catch (err: unknown) {
					const isDuplicate =
						err &&
						typeof err === "object" &&
						"code" in err &&
						(err as { code: number }).code === 11000;
					if (isDuplicate) {
						const current = await reconstructState(gameId);
						if (current) {
							setSessionState(gameId, current);
							io.to(gameId).emit("state", {
								gameId,
								turn: current.turn,
								state: current,
							});
						}
						return;
					}
					throw err;
				}

				setSessionState(gameId, result.state);
				io.to(gameId).emit("state", { gameId, turn: newTurn, state: result.state });
			});
		},
	);
}
