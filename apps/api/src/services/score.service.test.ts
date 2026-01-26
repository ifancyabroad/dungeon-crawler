import { describe, it, expect } from "vitest";

// Note: These are example unit tests. In a real scenario, you would mock
// mongoose or use a test database. These tests demonstrate the testing setup.

describe("Score Service", () => {
	it("should be defined", async () => {
		// Dynamic import to avoid mongoose connection during tests
		const scoreService = await import("./score.service");
		expect(scoreService.listTopScores).toBeDefined();
		expect(scoreService.createScore).toBeDefined();
	});

	it("listTopScores should be a function", async () => {
		const { listTopScores } = await import("./score.service");
		expect(typeof listTopScores).toBe("function");
	});

	it("createScore should be a function", async () => {
		const { createScore } = await import("./score.service");
		expect(typeof createScore).toBe("function");
	});
});

describe("Score validation (using shared schema)", () => {
	it("should validate a correct score", async () => {
		const { ScoreSchema } = await import("@app/shared");

		const result = ScoreSchema.safeParse({
			player: "TestPlayer",
			points: 100,
		});

		expect(result.success).toBe(true);
	});

	it("should reject negative points", async () => {
		const { ScoreSchema } = await import("@app/shared");

		const result = ScoreSchema.safeParse({
			player: "TestPlayer",
			points: -10,
		});

		expect(result.success).toBe(false);
	});

	it("should reject missing player", async () => {
		const { ScoreSchema } = await import("@app/shared");

		const result = ScoreSchema.safeParse({
			points: 100,
		});

		expect(result.success).toBe(false);
	});
});
