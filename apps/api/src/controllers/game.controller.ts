import { randomBytes } from "node:crypto";
import type { RequestHandler } from "express";
import {
	createInitialState,
	createGameBodySchema,
	DEFAULT_FLOOR_CONFIG,
	gameStateToPersisted,
	PersistedDynamicStateSchema,
	type HeroInit,
} from "@app/shared";
import { classesById, type CharacterClassId } from "@app/content";
import { GameSession } from "../models/gameSession.model";
import { GameSnapshot } from "../models/gameSnapshot.model";
import { Hero } from "../models/hero.model";
import { getSessionState, reconstructState, setSessionState } from "../services/gameState.service";
import { COOKIE_NAME, hashToken } from "../lib/gameToken";
import { env } from "../config/env";
import { runTransaction } from "../config/db";

const COOKIE_OPTS = {
	httpOnly: true,
	sameSite: "lax" as const,
	path: "/",
	secure: env.NODE_ENV === "production",
	maxAge: 365 * 24 * 60 * 60 * 1000,
};

/**
 * Creates a new game session with a chosen class and hero name.
 * Retires any existing active hero for this browser, creates a new Hero doc,
 * and writes snapshot + session to DB in a transaction.
 */
export const createGame: RequestHandler = async (req, res) => {
	const body = createGameBodySchema.parse(req.body ?? {});
	const gameId = randomBytes(16).toString("hex");
	const token = randomBytes(32).toString("hex");
	const tokenHash = hashToken(token, env.GAME_TOKEN_PEPPER);
	const now = new Date();

	const classDef = classesById[body.classId as CharacterClassId];
	if (!classDef) {
		return res.status(400).json({ error: `Unknown class: ${body.classId}` });
	}

	const heroInit: HeroInit = {
		name: body.heroName,
		classId: classDef.id,
		hp: classDef.startingHp,
		maxHp: classDef.startingHp,
		attributes: { ...classDef.baseAttributes },
	};

	const seed = body.seed ?? randomBytes(4).readUInt32BE(0);
	const state = createInitialState(seed, DEFAULT_FLOOR_CONFIG, heroInit);
	const persistedState = gameStateToPersisted(state);
	PersistedDynamicStateSchema.parse(persistedState);

	await runTransaction(async (session) => {
		await Hero.updateMany(
			{ tokenHash, status: "active" },
			{ $set: { status: "retired" } },
			{ session },
		);

		await Hero.create(
			[{ gameId, tokenHash, name: body.heroName, classId: classDef.id, status: "active" }],
			{ session },
		);

		await GameSnapshot.create([{ gameId, turn: 0, state: persistedState, createdAt: now }], {
			session,
		});
		await GameSession.create(
			[
				{
					gameId,
					tokenHash,
					lastSeenAt: now,
					userId: null,
					seed,
					mapGenVersion: state.mapGenVersion,
					floorConfigs: state.floors.map((f) => f.config),
					latestSnapshotTurn: 0,
				},
			],
			{ session },
		);
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
