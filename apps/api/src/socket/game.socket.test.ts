import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import http from "node:http";
import { io as ioClient } from "socket.io-client";
import type { GameState } from "@app/shared";
import type { Socket } from "socket.io-client";

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
const mockSnapshotCreate = vi.fn().mockResolvedValue(undefined);
const mockActionLogCreate = vi.fn().mockResolvedValue(undefined);

const mockUpdateOne = vi.fn().mockReturnValue({
	exec: vi.fn().mockImplementation(() => {
		return Promise.resolve({ acknowledged: true });
	}),
});

const mockFindOne = vi.fn().mockImplementation((query: { gameId?: string }) => ({
	lean: () => ({
		exec: () =>
			Promise.resolve(
				query.gameId && capturedSession?.gameId === query.gameId ? capturedSession : null,
			),
	}),
}));

vi.mock("../models/gameSession.model", () => ({
	GameSession: {
		create: mockSessionCreate,
		findOne: mockFindOne,
		updateOne: mockUpdateOne,
	},
}));

vi.mock("../models/gameSnapshot.model", () => ({
	GameSnapshot: { create: mockSnapshotCreate },
}));

vi.mock("../models/gameActionLog.model", () => ({
	GameActionLog: { create: mockActionLogCreate },
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

describe("game socket", () => {
	let server: http.Server;
	let baseUrl: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		capturedSession = null;
		mockFindOne.mockImplementation((query: { gameId?: string }) => ({
			lean: () => ({
				exec: () =>
					Promise.resolve(
						query.gameId && capturedSession?.gameId === query.gameId
							? capturedSession
							: null,
					),
			}),
		}));
		mockSessionCreate.mockImplementation((doc: unknown) => {
			capturedSession = (Array.isArray(doc) ? doc[0] : doc) as typeof capturedSession;
			return Promise.resolve();
		});

		const { buildApp } = await import("../app");
		const { Server } = await import("socket.io");
		const { attachSocket } = await import("./index");

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
	);

	it("join emits state with gameId, turn, and state", async () => {
		const res = await fetch(`${baseUrl}/api/game`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ classId: "warrior", heroName: "Tester" }),
			redirect: "manual",
		});
		expect(res.status).toBe(201);
		const body = (await res.json()) as { gameId: string };
		const gameId = body.gameId;
		const setCookie = res.headers.get("set-cookie");
		const token = parseGameToken(setCookie ?? undefined);
		expect(token).toBeTruthy();
		expect(capturedSession).toBeTruthy();
		expect(capturedSession?.gameId).toBe(gameId);

		const client = ioClient(baseUrl, {
			extraHeaders: { Cookie: `game_token=${token}` },
			transports: ["websocket"],
		});
		try {
			client.emit("join", { gameId });
			const stateEvent = await waitForEvent<{
				gameId: string;
				turn: number;
				state: GameState;
			}>(client, "state", 3000);

			expect(stateEvent.gameId).toBe(gameId);
			expect(stateEvent.turn).toBe(0);
			expect(stateEvent.state).toHaveProperty("heroId", "hero");
			expect(stateEvent.state).toHaveProperty("heroFloorIndex", 0);
			expect(stateEvent.state.floors).toBeDefined();
			expect(stateEvent.state.floors[0].state.actorsById).toHaveProperty("hero");
			expect(stateEvent.state.floors[0].state.actorsById.hero).toHaveProperty("idx");
		} finally {
			client.disconnect();
		}
	});

	it("action move updates state and emits new state", async () => {
		const res = await fetch(`${baseUrl}/api/game`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ seed: 12345, classId: "warrior", heroName: "Tester" }),
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
			const { ActionSchema, applyActionWithDerivedContext } = await import("@app/shared");

			client.emit("join", { gameId });
			const joinState = await waitForEvent<{ state: GameState }>(client, "state", 3000);

			const directions = ["up", "down", "left", "right"] as const;
			const selectedDirection = directions.find((direction) => {
				const result = applyActionWithDerivedContext(
					joinState.state,
					ActionSchema.parse({ type: "move", direction }),
				);
				return result.ok;
			});
			expect(selectedDirection).toBeDefined();
			if (!selectedDirection) return;

			const stateAfterMovePromise = waitForEvent<{ state: GameState }>(client, "state", 5000);
			client.emit("action", {
				gameId,
				action: { type: "move", direction: selectedDirection },
				expectedTurn: joinState.state.turn,
			});
			const stateAfterMove = await stateAfterMovePromise;

			expect(stateAfterMove.state.turn).toBe(joinState.state.turn + 1);
		} finally {
			client.disconnect();
		}
	});

	it("invalid action schema emits error", async () => {
		const res = await fetch(`${baseUrl}/api/game`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ classId: "warrior", heroName: "Tester" }),
			redirect: "manual",
		});
		const body = (await res.json()) as { gameId: string };
		const token = parseGameToken(res.headers.get("set-cookie") ?? undefined);
		const client = ioClient(baseUrl, {
			extraHeaders: { Cookie: `game_token=${token}` },
			transports: ["websocket"],
		});

		try {
			client.emit("join", { gameId: body.gameId });
			await waitForEvent(client, "state", 3000);

			const errPromise = waitForEvent<{ reason?: string }>(client, "error", 3000);
			client.emit("action", {
				gameId: body.gameId,
				action: { type: "move", direction: "invalid" },
			});
			const err = await errPromise;
			expect(err.reason).toBe("invalid_action");
		} finally {
			client.disconnect();
		}
	});
});
