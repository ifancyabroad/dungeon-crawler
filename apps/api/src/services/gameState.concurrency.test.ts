/**
 * Phase 0/1: Concurrency test — N simultaneous actions with same expectedTurn → exactly one applied.
 * Assert turn invariant: logged turn = expectedTurn + 1.
 */
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import http from "node:http";
import { io as ioClient } from "socket.io-client";
import type { Action, GameState } from "@app/shared";
import { createInitialState, DEFAULT_FLOOR_CONFIG, DEFAULT_HERO_INIT } from "@app/shared";
import type { Socket } from "socket.io-client";
import { ActionSchema, applyActionWithDerivedContext } from "@app/shared";

process.env.MONGO_URI = "mongodb://localhost:27017/test";
process.env.GAME_TOKEN_PEPPER = "test-pepper";

let capturedSession: {
	gameId: string;
	tokenHash: string;
	lastSeenAt: Date;
	userId: null;
	seed: number;
	mapGenVersion: number;
	floorConfigs: unknown[];
	latestSnapshotTurn: number;
} | null = null;

const mockSessionCreate = vi.fn().mockImplementation((doc: unknown) => {
	capturedSession = (Array.isArray(doc) ? doc[0] : doc) as typeof capturedSession;
	return Promise.resolve();
});

let capturedSnapshot: { gameId: string; turn: number; state: unknown } | null = null;
const mockSnapshotCreate = vi.fn().mockImplementation((doc: unknown) => {
	const d = Array.isArray(doc) ? doc[0] : doc;
	capturedSnapshot = d as { gameId: string; turn: number; state: unknown };
	return Promise.resolve();
});

const createCalls: { gameId: string; turn: number }[] = [];
const mockActionLogCreate = vi.fn().mockImplementation((doc: unknown) => {
	const d = Array.isArray(doc) ? doc[0] : doc;
	createCalls.push({
		gameId: (d as { gameId: string; turn: number }).gameId,
		turn: (d as { gameId: string; turn: number }).turn,
	});
	return Promise.resolve();
});

const mockUpdateOne = vi.fn().mockReturnValue({
	exec: vi.fn().mockResolvedValue({ acknowledged: true }),
});

const mockSessionFindOne = vi.fn().mockImplementation((query: { gameId?: string }) => ({
	lean: () => ({
		exec: () =>
			Promise.resolve(
				query.gameId && capturedSession?.gameId === query.gameId ? capturedSession : null,
			),
	}),
}));

const mockSnapshotFindOne = vi
	.fn()
	.mockImplementation((query: { gameId?: string; turn?: number }) => ({
		lean: () => ({
			exec: () =>
				Promise.resolve(
					capturedSnapshot &&
						query.gameId === capturedSnapshot.gameId &&
						query.turn === capturedSnapshot.turn
						? capturedSnapshot
						: null,
				),
		}),
	}));

const mockFind = vi.fn().mockReturnValue({
	sort: () => ({
		lean: () => ({
			exec: () => Promise.resolve([]),
		}),
	}),
});

vi.mock("../models/gameSession.model", () => ({
	GameSession: {
		create: mockSessionCreate,
		findOne: mockSessionFindOne,
		updateOne: mockUpdateOne,
	},
}));

vi.mock("../models/gameSnapshot.model", () => ({
	GameSnapshot: {
		create: mockSnapshotCreate,
		findOne: mockSnapshotFindOne,
	},
}));

vi.mock("../models/gameActionLog.model", () => ({
	GameActionLog: {
		create: mockActionLogCreate,
		find: mockFind,
	},
}));

vi.mock("../models/hero.model", () => ({
	Hero: {
		create: vi.fn().mockResolvedValue(undefined),
		updateMany: vi.fn().mockResolvedValue({ acknowledged: true }),
	},
}));

vi.mock("../config/db", () => ({
	runTransaction: (fn: (session: unknown) => Promise<unknown>) => fn({}),
}));

function parseGameToken(setCookie: string | string[] | undefined): string | null {
	const str = Array.isArray(setCookie) ? setCookie[0] : setCookie;
	const match = str?.match(/game_token=([^;]+)/);
	return match ? match[1].trim() : null;
}

function waitForEvent<T>(client: Socket, eventName: string, timeoutMs: number): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timeout = setTimeout(() => {
			client.off(eventName, onEvent);
			reject(new Error(`timeout waiting for ${eventName}`));
		}, timeoutMs);
		const onEvent = (payload: T) => {
			clearTimeout(timeout);
			client.off(eventName, onEvent);
			resolve(payload);
		};
		client.on(eventName, onEvent);
	});
}

async function waitForCondition(
	condition: () => boolean,
	timeoutMs: number,
	intervalMs = 25,
): Promise<void> {
	const started = Date.now();
	while (!condition()) {
		if (Date.now() - started > timeoutMs) {
			throw new Error("timeout waiting for condition");
		}
		await new Promise((resolve) => setTimeout(resolve, intervalMs));
	}
}

function pickFirstValidAction(state: GameState): Action | null {
	const candidates: Action[] = [
		{ type: "move", direction: "up" },
		{ type: "move", direction: "down" },
		{ type: "move", direction: "left" },
		{ type: "move", direction: "right" },
		{ type: "attack", direction: "up" },
		{ type: "attack", direction: "down" },
		{ type: "attack", direction: "left" },
		{ type: "attack", direction: "right" },
	];
	if (state.pendingInteraction?.type === "skill_choice") {
		candidates.push({ type: "reroll_skill_choice" });
		const [firstOffer] = state.pendingInteraction.offers;
		if (firstOffer) candidates.push({ type: "select_skill_choice", skillId: firstOffer });
	}
	return (
		candidates.find(
			(action) => applyActionWithDerivedContext(state, ActionSchema.parse(action)).ok,
		) ?? null
	);
}

describe("gameState concurrency", () => {
	let server: http.Server;
	let baseUrl: string;

	beforeEach(async () => {
		const { __resetGameLocksForTest } = await import("./gameLock");
		__resetGameLocksForTest();
		vi.clearAllMocks();
		createCalls.length = 0;
		capturedSession = null;
		capturedSnapshot = null;
		mockSessionFindOne.mockImplementation((query: { gameId?: string }) => ({
			lean: () => ({
				exec: () =>
					Promise.resolve(
						query.gameId && capturedSession?.gameId === query.gameId
							? capturedSession
							: null,
					),
			}),
		}));
		mockSnapshotFindOne.mockImplementation((query: { gameId?: string; turn?: number }) => ({
			lean: () => ({
				exec: () =>
					Promise.resolve(
						capturedSnapshot &&
							query.gameId === capturedSnapshot.gameId &&
							query.turn === capturedSnapshot.turn
							? capturedSnapshot
							: null,
					),
			}),
		}));
		mockSessionCreate.mockImplementation((doc: unknown) => {
			capturedSession = (Array.isArray(doc) ? doc[0] : doc) as typeof capturedSession;
			return Promise.resolve();
		});
		mockSnapshotCreate.mockImplementation((doc: unknown) => {
			const d = Array.isArray(doc) ? doc[0] : doc;
			capturedSnapshot = d as { gameId: string; turn: number; state: unknown };
			return Promise.resolve();
		});

		const { buildApp } = await import("../app");
		const { Server } = await import("socket.io");
		const { attachSocket } = await import("../socket/index");

		const app = buildApp();
		server = http.createServer(app);
		const io = new Server(server, { cors: { origin: "*" } });
		attachSocket(io);

		await new Promise<void>((resolve) => {
			server.listen(0, () => {
				const addr = server.address();
				const port = typeof addr === "object" && addr?.port ? addr.port : 0;
				baseUrl = `http://127.0.0.1:${port}`;
				resolve();
			});
		});
	});

	afterEach(
		() =>
			new Promise<void>((resolve) => {
				if (server) server.close(() => resolve());
				else resolve();
			}),
		15000,
	);

	it("withGameLock serializes 5 concurrent action pipelines (direct call, same module as lock)", async () => {
		const { withGameLock } = await import("./gameLock");
		const { ensureSessionLoaded, setSessionState, applyAuthoritativeAction } =
			await import("./gameState.service");
		const { GameActionLog } = await import("../models/gameActionLog.model");

		const gameId = "direct-test-game";
		const state0 = createInitialState(12345, [DEFAULT_FLOOR_CONFIG], DEFAULT_HERO_INIT);
		setSessionState(gameId, state0);

		const expectedTurn = 0;
		const action = { type: "move" as const, direction: "right" as const };

		type Result = { kind: "state"; turn: number } | { kind: "error"; reason: string };
		const runOne = (): Promise<Result> =>
			withGameLock(gameId, async () => {
				const state = await ensureSessionLoaded(gameId);
				if (!state) return { kind: "error", reason: "state_not_found" };
				if (expectedTurn !== state.turn) return { kind: "error", reason: "turn_mismatch" };
				const result = applyAuthoritativeAction(gameId, state, action);
				if (!result.ok) return { kind: "error", reason: result.reason };
				await GameActionLog.create({ gameId, turn: result.state.turn, action });
				setSessionState(gameId, result.state);
				return { kind: "state", turn: result.state.turn };
			});

		const N = 5;
		const results = await Promise.all(Array.from({ length: N }, () => runOne()));

		const states = results.filter(
			(r): r is { kind: "state"; turn: number } => r.kind === "state",
		);
		const errors = results.filter(
			(r): r is { kind: "error"; reason: string } => r.kind === "error",
		);
		const turnMismatch = errors.filter((r) => r.reason === "turn_mismatch");

		expect(states.length).toBe(1);
		expect(states[0].turn).toBe(expectedTurn + 1);
		expect(turnMismatch.length).toBe(N - 1);
		expect(mockActionLogCreate).toHaveBeenCalledTimes(1);
		expect(createCalls.length).toBe(1);
		expect(createCalls[0].gameId).toBe(gameId);
		expect(createCalls[0].turn).toBe(expectedTurn + 1);
	});

	it("N concurrent actions with same expectedTurn → exactly one log entry (socket integration)", async () => {
		const res = await fetch(`${baseUrl}/api/game`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ classId: "warrior", heroName: "Tester" }),
			redirect: "manual",
		});
		expect(res.status).toBe(201);
		const body = (await res.json()) as { gameId: string };
		const gameId = body.gameId;
		const token = parseGameToken(res.headers.get("set-cookie") ?? undefined);
		expect(token).toBeTruthy();

		const client = ioClient(baseUrl, {
			extraHeaders: { Cookie: `game_token=${token}` },
			transports: ["websocket"],
		});
		try {
			client.emit("join", { gameId });
			const joinState = await waitForEvent<{ state: GameState }>(client, "state", 3000);
			const expectedTurn = joinState.state.turn;
			expect(expectedTurn).toBe(0);
			const selectedAction = pickFirstValidAction(joinState.state);
			expect(selectedAction).toBeDefined();
			if (!selectedAction) return;

			const N = 5;
			const stateEvents: { turn: number }[] = [];
			client.on("state", (p: { turn: number }) => stateEvents.push(p));

			for (let i = 0; i < N; i++) {
				client.emit("action", {
					gameId,
					action: selectedAction,
					expectedTurn,
				});
			}

			await waitForCondition(() => createCalls.length >= 1, 8000);
			expect(createCalls.length).toBe(1);
			expect(createCalls[0].gameId).toBe(gameId);
			expect(createCalls[0].turn).toBe(expectedTurn + 1);
			expect(mockActionLogCreate).toHaveBeenCalledTimes(1);

			await waitForCondition(() => stateEvents.some((event) => event.turn >= 1), 5000);

			// Explicit stale turn check (deterministic) instead of relying on exact async event counts.
			const staleErrorPromise = waitForEvent<{ reason?: string }>(client, "error", 5000);
			client.emit("action", {
				gameId,
				action: selectedAction,
				expectedTurn,
			});
			const staleError = await staleErrorPromise;
			expect(staleError.reason).toBe("turn_mismatch");
		} finally {
			client.disconnect();
		}
	}, 15000);
});
