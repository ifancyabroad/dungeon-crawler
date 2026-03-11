import { randomBytes } from "node:crypto";
import type { RequestHandler } from "express";
import {
	computeWalkableMaskForFloor,
	createInitialState,
	createGameBodySchema,
	DEFAULT_FLOOR_CONFIG,
	gameStateToPersisted,
	getActorAtIdx,
	PersistedDynamicStateSchema,
	regenerateBaseMaps,
	resetMonsterCounter,
	spawnMonster,
	type HeroInit,
	type MonsterInit,
} from "@app/shared";
import { classesById, monstersById, type CharacterClassId, type MonsterId } from "@app/content";
import { GameSession } from "../models/gameSession.model";
import { GameSnapshot } from "../models/gameSnapshot.model";
import { Hero } from "../models/hero.model";
import { getSessionState, reconstructState, setSessionState } from "../services/gameState.service";
import { COOKIE_NAME, hashToken } from "../lib/gameToken";
import { env } from "../config/env";
import { runTransaction } from "../config/db";
import { getCookie } from "../lib/cookies";

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
		level: 1,
		xp: 0,
		hitDie: classDef.hitDie,
	};

	const seed = body.seed ?? randomBytes(4).readUInt32BE(0);
	resetMonsterCounter();
	let state = createInitialState(seed, DEFAULT_FLOOR_CONFIG, heroInit);

	// Spawn goblins for testing
	const goblinDef = monstersById["goblin" as MonsterId];
	if (goblinDef) {
		const baseLayers = regenerateBaseMaps(
			seed,
			state.floors.map((f) => f.config),
			state.mapGenVersion,
		);
		const walkMask = computeWalkableMaskForFloor(
			baseLayers[0],
			state.floors[0].state.tileOverrides,
		);
		const floorWidth = state.floors[0].config.width;
		const floorHeight = state.floors[0].config.height;

		const goblinInit: MonsterInit = {
			monsterId: goblinDef.id,
			name: goblinDef.name,
			hp: goblinDef.hp,
			maxHp: goblinDef.hp,
			armorClass: goblinDef.armorClass,
			attributes: { ...goblinDef.baseAttributes },
			xpReward: goblinDef.xpReward,
		};

		// Spawn 5 goblins spread across the floor. For each, find the first unoccupied
		// walkable tile scanning from a deterministic offset so placement is seed-stable.
		const floorSize = floorWidth * floorHeight;
		const spawnOffsets = [
			0,
			Math.floor(floorSize * 0.2),
			Math.floor(floorSize * 0.4),
			Math.floor(floorSize * 0.6),
			Math.floor(floorSize * 0.8),
		];
		for (const offset of spawnOffsets) {
			let spawnIdx: number | undefined;
			for (let i = 0; i < floorSize; i++) {
				const idx = (offset + i) % floorSize;
				if (walkMask[idx] === 1 && !getActorAtIdx(state.floors[0].state, idx)) {
					spawnIdx = idx;
					break;
				}
			}
			if (spawnIdx !== undefined) {
				state = spawnMonster(state, 0, goblinInit, spawnIdx);
			}
		}
	}

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
 */
export const getGame: RequestHandler = async (_req, res) => {
	const session = res.locals.gameSession as { gameId: string };
	const cached = getSessionState(session.gameId);
	if (cached) {
		return res.json({ gameId: session.gameId, state: cached });
	}
	const state = await reconstructState(session.gameId);
	if (state) {
		return res.json({ gameId: session.gameId, state });
	}
	return res.status(404).json({ error: "Game state not found" });
};

/**
 * Lightweight check: does this browser have a continuable game (active, non-dead hero)?
 * No middleware required — reads cookie directly and queries Hero model.
 */
export const getGameStatus: RequestHandler = async (req, res) => {
	const token = getCookie(req, COOKIE_NAME);
	if (!token) {
		return res.json({ hasActiveHero: false });
	}
	const tokenHash = hashToken(token, env.GAME_TOKEN_PEPPER);
	const activeHero = await Hero.findOne({ tokenHash, status: "active" }).lean().exec();
	return res.json({ hasActiveHero: !!activeHero });
};
