import { beforeEach, describe, it, expect, vi } from "vitest";
import request from "supertest";
import { hashToken } from "../lib/gameToken";

process.env.MONGO_URI = "mongodb://localhost:27017/test";
process.env.GAME_TOKEN_PEPPER = "test-pepper";

const mockCreate = vi.fn().mockResolvedValue(undefined);
const mockUpdateOne = vi.fn().mockReturnValue({
	exec: vi.fn().mockResolvedValue({ acknowledged: true }),
});
const mockFindOne = vi.fn().mockReturnValue({
	lean: () => ({ exec: vi.fn().mockResolvedValue(null) }),
});

vi.mock("../models/gameSession.model", () => ({
	GameSession: {
		create: mockCreate,
		findOne: mockFindOne,
		updateOne: mockUpdateOne,
	},
}));

vi.mock("../models/gameSnapshot.model", () => ({
	GameSnapshot: { create: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("../models/gameActionLog.model", () => ({
	GameActionLog: { create: vi.fn().mockResolvedValue(undefined) },
}));

const mockReconstructState = vi.fn().mockResolvedValue(null);
vi.mock("../services/gameState.service", () => ({
	reconstructState: (...args: unknown[]) => mockReconstructState(...args),
	getSessionState: vi.fn(),
	setSessionState: vi.fn(),
	deleteSessionState: vi.fn(),
}));

const { buildApp } = await import("../app");
const app = buildApp();

beforeEach(() => {
	vi.clearAllMocks();
	mockFindOne.mockReturnValue({
		lean: () => ({ exec: vi.fn().mockResolvedValue(null) }),
	});
});

describe("POST /api/game", () => {
	it("returns 201 with gameId and sets game_token cookie (HttpOnly, SameSite=Lax)", async () => {
		const res = await request(app).post("/api/game").expect(201);

		expect(res.body).toHaveProperty("gameId");
		expect(typeof res.body.gameId).toBe("string");
		expect(res.body.gameId.length).toBeGreaterThan(0);

		const setCookie = res.headers["set-cookie"];
		const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
		expect(cookies.length).toBeGreaterThan(0);
		expect(cookies.some((c: string) => c.includes("game_token="))).toBe(true);
		expect(cookies.some((c: string) => c.includes("HttpOnly"))).toBe(true);
		expect(cookies.some((c: string) => c.includes("SameSite=Lax"))).toBe(true);
	});
});

describe("GET /api/game", () => {
	it("returns 401 when cookie is missing", async () => {
		await request(app).get("/api/game").expect(401);
	});

	it("returns 401 when no session for token", async () => {
		mockFindOne.mockReturnValueOnce({
			lean: () => ({ exec: vi.fn().mockResolvedValueOnce(null) }),
		});
		await request(app).get("/api/game").set("Cookie", "game_token=any-token").expect(401);
	});

	it("returns 200 with gameId and state when cookie is valid", async () => {
		const gameId = "my-game-id";
		const token = "my-token";
		const tokenHash = hashToken(token, "test-pepper");
		const state = {
			turn: 0,
			heroId: "hero",
			heroFloorIndex: 0,
			seed: 42,
			mapGenVersion: 1,
			floors: [
				{
					config: { width: 50, height: 50, theme: "green_forest" },
					state: {
						tileOverrides: {},
						actorsById: {
							hero: {
								id: "hero",
								name: "Hero",
								idx: 10 * 50 + 10,
								alive: true,
								hp: 100,
								maxHp: 100,
								attributes: {
									strength: 10,
									dexterity: 10,
									constitution: 10,
									intelligence: 10,
									wisdom: 10,
									charisma: 10,
								},
								skills: {},
								def: { type: "hero" as const, classId: "warrior" },
							},
						},
					},
				},
			],
			rngState: { algo: "xorshift32" as const, s: 42 },
		};

		mockFindOne.mockReturnValueOnce({
			lean: () => ({
				exec: vi.fn().mockResolvedValueOnce({ gameId, tokenHash }),
			}),
		});
		mockReconstructState.mockResolvedValueOnce(state);

		const res = await request(app)
			.get("/api/game")
			.set("Cookie", `game_token=${token}`)
			.expect(200);

		expect(res.body).toHaveProperty("gameId", gameId);
		expect(res.body).toHaveProperty("state");
		expect(res.body.state).toHaveProperty("heroId", "hero");
		expect(res.body.state).toHaveProperty("heroFloorIndex", 0);
		expect(res.body.state.floors[0].state.actorsById).toHaveProperty("hero");
		expect(res.body.state.floors[0].state.actorsById.hero.idx).toBe(510);
	});
});
