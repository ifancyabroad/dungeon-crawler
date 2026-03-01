/**
 * Game socket handlers: join (auth + state load) and action (validate, apply, persist, broadcast).
 * Action log turn = turn BEFORE apply (expectedTurn). Uses gameState.service for session state.
 */

import type { Server } from "socket.io";
import type { Socket } from "socket.io";
import { ActionSchema, applyAction } from "@app/shared";
import type { GameState } from "@app/shared";
import { GameSession } from "../models/gameSession.model";
import { GameActionLog } from "../models/gameActionLog.model";
import { GameSnapshot } from "../models/gameSnapshot.model";
import { getSessionState, setSessionState, reconstructState } from "../services/gameState.service";
import { verifyToken } from "../lib/gameToken";
import { env } from "../config/env";

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

		let state: GameState | undefined = getSessionState(gameId);
		if (!state) {
			state = (await reconstructState(gameId)) ?? undefined;
			if (state) setSessionState(gameId, state);
		}
		if (!state) {
			socket.emit("error", { reason: "state_not_found" });
			return;
		}

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

			let state = getSessionState(gameId);
			if (!state) {
				state = (await reconstructState(gameId)) ?? undefined;
				if (state) setSessionState(gameId, state);
			}
			if (!state) {
				socket.emit("error", { reason: "state_not_found" });
				return;
			}

			if (expectedTurn !== state.turn) {
				socket.emit("error", { reason: "turn_mismatch", currentTurn: state.turn });
				return;
			}

			const result = applyAction(state, parsed.data);
			if (!result.ok) {
				socket.emit("error", { reason: result.reason });
				return;
			}

			try {
				await GameActionLog.create({
					gameId,
					turn: expectedTurn,
					action: parsed.data,
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
						io.to(gameId).emit("state", { gameId, turn: current.turn, state: current });
					}
					return;
				}
				throw err;
			}

			setSessionState(gameId, result.state);
			const newTurn = result.state.turn;

			if (newTurn % SNAPSHOT_INTERVAL === 0) {
				const persistedState = {
					turn: newTurn,
					hero: result.state.hero,
					floors: result.state.floors.map((f) => f.state),
					rngState: result.state.rngState,
				};
				await GameSnapshot.create({
					gameId,
					turn: newTurn,
					state: persistedState,
					createdAt: new Date(),
				});
				await GameSession.updateOne(
					{ gameId },
					{ $set: { latestSnapshotTurn: newTurn, lastSeenAt: new Date() } },
				).exec();
			} else {
				await GameSession.updateOne(
					{ gameId },
					{ $set: { lastSeenAt: new Date() } },
				).exec();
			}

			io.to(gameId).emit("state", { gameId, turn: newTurn, state: result.state });
		},
	);
}
