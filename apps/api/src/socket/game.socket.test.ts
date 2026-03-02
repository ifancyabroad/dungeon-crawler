import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import http from "node:http";
import { io as ioClient } from "socket.io-client";
import type { GameState } from "@app/shared";

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
	capturedSession = doc as typeof capturedSession;
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

function parseGameToken(setCookie: string | string[] | undefined): string | null {
	const str = Array.isArray(setCookie) ? setCookie[0] : setCookie;
	const match = str?.match(/game_token=([^;]+)/);
	return match ? match[1].trim() : null;
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
			capturedSession = doc as typeof capturedSession;
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
		const res = await fetch(`${baseUrl}/api/game`, { method: "POST", redirect: "manual" });
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

		const stateEvent = await new Promise<{ gameId: string; turn: number; state: GameState }>(
			(resolve, reject) => {
				const t = setTimeout(() => reject(new Error("timeout waiting for state")), 3000);
				client.on("state", (payload) => {
					clearTimeout(t);
					resolve(payload);
				});
				client.emit("join", { gameId });
			},
		);

		expect(stateEvent.gameId).toBe(gameId);
		expect(stateEvent.turn).toBe(0);
		expect(stateEvent.state).toHaveProperty("heroId", "hero");
		expect(stateEvent.state).toHaveProperty("heroFloorIndex", 0);
		expect(stateEvent.state.floors).toBeDefined();
		expect(stateEvent.state.floors[0].state.actorsById).toHaveProperty("hero");
		expect(stateEvent.state.floors[0].state.actorsById.hero).toHaveProperty("idx");

		client.disconnect();
	});

	it("action move updates state and emits new state", async () => {
		const res = await fetch(`${baseUrl}/api/game`, { method: "POST", redirect: "manual" });
		expect(res.status).toBe(201);
		const body = (await res.json()) as { gameId: string };
		const gameId = body.gameId;
		const token = parseGameToken(res.headers.get("set-cookie") ?? undefined);
		expect(token).toBeTruthy();

		const client = ioClient(baseUrl, {
			extraHeaders: { Cookie: `game_token=${token}` },
			transports: ["websocket"],
		});

		const { getHero, idxToXY } = await import("@app/shared");
		const joinState = await new Promise<{ state: GameState }>((resolve, reject) => {
			const t = setTimeout(() => reject(new Error("timeout")), 2000);
			client.on("state", (p) => {
				clearTimeout(t);
				resolve(p);
			});
			client.emit("join", { gameId });
		});
		const initialHero = getHero(joinState.state);
		expect(initialHero).toBeDefined();
		const width = joinState.state.floors[0].config.width;
		const initialPos = idxToXY(initialHero!.idx, width);
		const stateAfterMove = await new Promise<{ state: GameState }>((resolve, reject) => {
			const t = setTimeout(
				() => reject(new Error("timeout waiting for state after move")),
				5000,
			);
			client.on("state", (payload) => {
				clearTimeout(t);
				resolve(payload);
			});
			client.on("error", (payload: { reason?: string }) => {
				clearTimeout(t);
				reject(new Error(`socket error: ${payload.reason ?? "unknown"}`));
			});
			client.emit("action", {
				gameId,
				action: { type: "move", direction: "right" },
				expectedTurn: joinState.state.turn,
			});
		});

		const heroAfter = getHero(stateAfterMove.state);
		expect(heroAfter).toBeDefined();
		const posAfter = idxToXY(heroAfter!.idx, width);
		expect(posAfter.x).toBe(initialPos.x + 1);
		expect(posAfter.y).toBe(initialPos.y);
		expect(stateAfterMove.state.turn).toBe(1);

		client.disconnect();
	});

	it("invalid action schema emits error", async () => {
		const res = await fetch(`${baseUrl}/api/game`, { method: "POST", redirect: "manual" });
		const body = (await res.json()) as { gameId: string };
		const token = parseGameToken(res.headers.get("set-cookie") ?? undefined);
		const client = ioClient(baseUrl, {
			extraHeaders: { Cookie: `game_token=${token}` },
			transports: ["websocket"],
		});

		await new Promise<void>((resolve, reject) => {
			client.on("state", () => resolve());
			client.emit("join", { gameId: body.gameId });
			setTimeout(() => reject(new Error("timeout")), 2000);
		});

		const err = await new Promise<{ reason: string }>((resolve, reject) => {
			client.on("error", (payload: { reason?: string }) =>
				resolve({ reason: payload.reason ?? "" }),
			);
			client.emit("action", {
				gameId: body.gameId,
				action: { type: "move", direction: "invalid" },
			});
			setTimeout(() => reject(new Error("timeout")), 1500);
		});

		client.disconnect();
		expect(err.reason).toBe("invalid_action");
	});
});
