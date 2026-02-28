/**
 * Socket.IO: join (cookie + gameId) and action (Move) handlers.
 * Auth via game_token cookie; applyAction with stored walkable.
 */

import type { Server } from "socket.io";
import type { Socket } from "socket.io";
import { ActionSchema, applyAction, createRng } from "@app/shared";
import type { GameState } from "@app/shared";
import { GameSession } from "../models/gameSession.model";
import { parseCookie } from "../lib/cookies";
import { verifyToken } from "../lib/gameToken";
import { env } from "../config/env";

const COOKIE_NAME = "game_token";

function getToken(socket: Socket): string | undefined {
	const cookieHeader = socket.handshake.headers.cookie;
	return parseCookie(typeof cookieHeader === "string" ? cookieHeader : undefined, COOKIE_NAME);
}

export function attachSocket(io: Server): void {
	io.on("connection", (socket: Socket) => {
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

			socket.join(gameId);
			const state = session.state as GameState;
			socket.emit("state", { gameId, turn: state.turn, state });
		});

		socket.on("action", async (payload: { gameId?: string; action?: unknown }) => {
			const gameId = payload?.gameId;
			const action = payload?.action;
			if (!gameId || typeof gameId !== "string") {
				socket.emit("error", { reason: "invalid_action" });
				return;
			}

			const parsed = ActionSchema.safeParse(action);
			if (!parsed.success) {
				socket.emit("error", { reason: "invalid_action" });
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

			const currentState = session.state as GameState;
			const rng = createRng(currentState.seed);
			const result = applyAction(currentState, parsed.data, rng);

			if (!result.ok) {
				socket.emit("error", { reason: result.reason });
				return;
			}

			await GameSession.updateOne(
				{ gameId },
				{ $set: { state: result.state, lastSeenAt: new Date() } },
			).exec();

			io.to(gameId).emit("state", {
				gameId,
				turn: result.state.turn,
				state: result.state,
			});
		});
	});
}
