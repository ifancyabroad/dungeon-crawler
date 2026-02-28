import { randomBytes } from "node:crypto";
import type { RequestHandler } from "express";
import { GameSession } from "../models/gameSession.model";
import { hashToken } from "../lib/gameToken";
import { env } from "../config/env";

const COOKIE_NAME = "game_token";
const COOKIE_OPTS = {
	httpOnly: true,
	sameSite: "lax" as const,
	path: "/",
	secure: env.NODE_ENV === "production",
	maxAge: 365 * 24 * 60 * 60 * 1000,
};

/**
 * Creates a new game session. Overwrites any existing game_token cookie
 * (one active game per browser — this becomes the current run).
 */
export const createGame: RequestHandler = async (_req, res) => {
	const gameId = randomBytes(16).toString("hex");
	const token = randomBytes(32).toString("hex");
	const tokenHash = hashToken(token, env.GAME_TOKEN_PEPPER);
	const now = new Date();

	await GameSession.create({
		gameId,
		tokenHash,
		lastSeenAt: now,
		userId: null,
	});

	res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
	res.status(201).json({ gameId });
};

/**
 * Returns minimal session info. Requires gameAuth middleware (cookie + valid token).
 */
export const getGame: RequestHandler = (_req, res) => {
	const session = res.locals.gameSession as { gameId: string; createdAt: Date };
	res.json({ gameId: session.gameId, createdAt: session.createdAt });
};
