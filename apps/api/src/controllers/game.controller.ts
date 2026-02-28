import { randomBytes } from "node:crypto";
import type { RequestHandler } from "express";
import { createInitialState, DEFAULT_MAP_HEIGHT, DEFAULT_MAP_WIDTH } from "@app/shared";
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

const DEFAULT_DECORATION_WEIGHTS: Record<string, number> = {
	grass: 10,
	plant: 5,
	bush: 3,
	rock: 2,
};

/**
 * Creates a new game session. Overwrites any existing game_token cookie
 * (one active game per browser — this becomes the current run).
 * Generates seed and initial state (with walkable grid), persists full state.
 */
export const createGame: RequestHandler = async (_req, res) => {
	const gameId = randomBytes(16).toString("hex");
	const token = randomBytes(32).toString("hex");
	const tokenHash = hashToken(token, env.GAME_TOKEN_PEPPER);
	const now = new Date();

	const seed = randomBytes(4).readUInt32BE(0);
	const mapConfig = {
		seed,
		width: DEFAULT_MAP_WIDTH,
		height: DEFAULT_MAP_HEIGHT,
		theme: "green_forest",
		algorithm: "cave" as const,
		caveFloorChance: 0.45,
		decorationWeights: DEFAULT_DECORATION_WEIGHTS,
		scatterChance: 0.28,
	};
	const state = createInitialState(seed, mapConfig);

	await GameSession.create({
		gameId,
		tokenHash,
		lastSeenAt: now,
		userId: null,
		state,
	});

	res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
	res.status(201).json({ gameId, seed, state });
};

/**
 * Returns the current game (for Continue). Requires requireGame middleware; session is in res.locals.
 */
export const getGame: RequestHandler = (_req, res) => {
	const session = res.locals.gameSession as { gameId: string; state: unknown };
	res.json({ gameId: session.gameId, state: session.state });
};
