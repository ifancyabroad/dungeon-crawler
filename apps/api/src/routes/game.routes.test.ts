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

const { buildApp } = await import("../app");
const app = buildApp();

beforeEach(() => {
	vi.clearAllMocks();
	mockFindOne.mockReturnValue({
		lean: () => ({ exec: vi.fn().mockResolvedValue(null) }),
	});
});

describe("POST /api/games", () => {
	it("returns 201 with gameId and sets game_token cookie (HttpOnly, SameSite=Lax)", async () => {
		const res = await request(app).post("/api/games").expect(201);

		expect(res.body).toHaveProperty("gameId");
		expect(typeof res.body.gameId).toBe("string");
		expect(res.body.gameId.length).toBeGreaterThan(0);

		const setCookie = res.headers["set-cookie"];
		expect(Array.isArray(setCookie)).toBe(true);
		expect(setCookie.some((c: string) => c.includes("game_token="))).toBe(true);
		expect(setCookie.some((c: string) => c.includes("HttpOnly"))).toBe(true);
		expect(setCookie.some((c: string) => c.includes("SameSite=Lax"))).toBe(true);
	});
});

describe("GET /api/games/:gameId", () => {
	it("returns 401 when cookie is missing", async () => {
		await request(app).get("/api/games/some-game-id").expect(401);
	});

	it("returns 404 when cookie present but gameId does not exist", async () => {
		await request(app)
			.get("/api/games/nonexistent-game-id-12345")
			.set("Cookie", "game_token=wrong-or-random-token")
			.expect(404);
	});

	it("returns 404 when cookie present but token does not match session", async () => {
		const gameId = "some-game-id";
		const wrongHash = hashToken("other-token", "test-pepper");
		mockFindOne.mockReturnValueOnce({
			lean: () => ({
				exec: vi.fn().mockResolvedValueOnce({
					gameId,
					tokenHash: wrongHash,
					createdAt: new Date(),
				}),
			}),
		});

		await request(app)
			.get(`/api/games/${gameId}`)
			.set("Cookie", "game_token=wrong-token-value")
			.expect(404);
	});

	it("returns 200 with session info when cookie is valid", async () => {
		const gameId = "valid-game-id";
		const token = "valid-token";
		const tokenHash = hashToken(token, "test-pepper");
		const createdAt = new Date();

		mockFindOne.mockReturnValueOnce({
			lean: () => ({
				exec: vi.fn().mockResolvedValueOnce({
					gameId,
					tokenHash,
					createdAt,
				}),
			}),
		});

		const getRes = await request(app)
			.get(`/api/games/${gameId}`)
			.set("Cookie", `game_token=${token}`)
			.expect(200);

		expect(getRes.body).toHaveProperty("gameId", gameId);
		expect(getRes.body).toHaveProperty("createdAt");
	});
});
