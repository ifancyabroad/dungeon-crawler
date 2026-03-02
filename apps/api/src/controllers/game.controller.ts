import { randomBytes } from "node:crypto";
import type { RequestHandler } from "express";
import {
	createInitialState,
	DEFAULT_MAP_HEIGHT,
	DEFAULT_MAP_WIDTH,
	DEFAULT_DECORATION_WEIGHTS,
} from "@app/shared";
import { GameSession } from "../models/gameSession.model";
import { GameSnapshot } from "../models/gameSnapshot.model";
import { getSessionState, reconstructState, setSessionState } from "../services/gameState.service";
import { hashToken } from "../lib/gameToken";
import { env } from "../config/env";
import { createGameBodySchema } from "@app/shared";

const COOKIE_NAME = "game_token";
const COOKIE_OPTS = {
	httpOnly: true,
	sameSite: "lax" as const,
	path: "/",
	secure: env.NODE_ENV === "production",
	maxAge: 365 * 24 * 60 * 60 * 1000,
};

/**
 * Creates a new game session. Writes snapshot at turn 0 (full dynamic state + rngState),
 * session metadata (no embedded state). Overwrites any existing game_token cookie.
 * Optional body: { seed?: number } to use a specific RNG seed (e.g. for debug/replay).
 */
export const createGame: RequestHandler = async (req, res) => {
	const body = createGameBodySchema.parse(req.body ?? {});
	const gameId = randomBytes(16).toString("hex");
	const token = randomBytes(32).toString("hex");
	const tokenHash = hashToken(token, env.GAME_TOKEN_PEPPER);
	const now = new Date();

	const seed = body.seed ?? randomBytes(4).readUInt32BE(0);
	const floorConfig = {
		width: DEFAULT_MAP_WIDTH,
		height: DEFAULT_MAP_HEIGHT,
		theme: "green_forest",
		algorithm: "cave" as const,
		caveFloorChance: 0.45,
		decorationWeights: DEFAULT_DECORATION_WEIGHTS,
		scatterChance: 0.28,
	};
	const state = createInitialState(seed, floorConfig);

	const persistedState = {
		turn: 0,
		heroId: state.heroId,
		heroFloorIndex: state.heroFloorIndex,
		floors: state.floors.map((f) => f.state),
		rngState: state.rngState,
	};

	await GameSnapshot.create({
		gameId,
		turn: 0,
		state: persistedState,
		createdAt: now,
	});

	await GameSession.create({
		gameId,
		tokenHash,
		lastSeenAt: now,
		userId: null,
		seed,
		mapGenVersion: state.mapGenVersion,
		floorConfigs: state.floors.map((f) => f.config),
		latestSnapshotTurn: 0,
	});

	setSessionState(gameId, state);

	res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
	res.status(201).json({ gameId, seed, state });
};

/**
 * Returns the current game (for Continue). Requires requireGame middleware.
 * Uses in-memory state if present, else reconstructs from latest snapshot + action log replay.
 * Legacy sessions (pre-migration, no snapshot) return 410 so the client can prompt for a new game.
 */
export const getGame: RequestHandler = async (_req, res) => {
	const session = res.locals.gameSession as {
		gameId: string;
		state?: unknown;
		latestSnapshotTurn?: number;
	};
	// Prefer in-memory state (e.g. same process that created the game)
	const cached = getSessionState(session.gameId);
	if (cached) {
		return res.json({ gameId: session.gameId, state: cached });
	}
	const state = await reconstructState(session.gameId);
	if (state) {
		return res.json({ gameId: session.gameId, state });
	}
	// Legacy session: has old embedded state, no snapshot (pre-migration)
	if ("state" in session && session.state != null && session.latestSnapshotTurn === undefined) {
		return res.status(410).json({
			error: "Legacy save from a previous version",
			code: "legacy_save",
		});
	}
	return res.status(404).json({ error: "Game state not found" });
};
