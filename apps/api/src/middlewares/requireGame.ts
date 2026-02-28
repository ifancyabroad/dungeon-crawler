import type { RequestHandler } from "express";
import { GameSession } from "../models/gameSession.model";
import { getCookie } from "../lib/cookies";
import { hashToken } from "../lib/gameToken";
import { env } from "../config/env";

const COOKIE_NAME = "game_token";

/**
 * Resolves session from game_token cookie (find by tokenHash).
 * 401 if cookie missing or no matching session. Sets res.locals.gameSession on success.
 */
export const requireGame: RequestHandler = async (req, res, next) => {
	const token = getCookie(req, COOKIE_NAME);
	if (!token) {
		return res.status(401).json({ error: "Unauthorized" });
	}

	const tokenHash = hashToken(token, env.GAME_TOKEN_PEPPER);
	const session = await GameSession.findOne({ tokenHash }).lean().exec();
	if (!session) {
		return res.status(401).json({ error: "Unauthorized" });
	}

	res.locals.gameSession = session;
	next();
};
