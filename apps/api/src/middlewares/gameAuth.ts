import type { RequestHandler } from "express";
import { GameSession } from "../models/gameSession.model";
import { getCookie } from "../lib/cookies";
import { verifyToken } from "../lib/gameToken";
import { env } from "../config/env";

export const gameAuth: RequestHandler = async (req, res, next) => {
	const token = getCookie(req, "game_token");
	if (!token) {
		return res.status(401).json({ error: "Unauthorized" });
	}

	const gameId = req.params.gameId;
	if (!gameId) {
		return res.status(404).json({ error: "Not Found" });
	}

	const session = await GameSession.findOne({ gameId }).lean().exec();
	if (!session || !verifyToken(token, session.tokenHash, env.GAME_TOKEN_PEPPER)) {
		return res.status(404).json({ error: "Not Found" });
	}

	await GameSession.updateOne({ gameId }, { $set: { lastSeenAt: new Date() } }).exec();

	res.locals.gameSession = session;
	next();
};
