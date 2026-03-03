/**
 * Phase 2: Invalid snapshot fails loudly (reconstructState throws or propagates error).
 */
import { beforeEach, describe, it, expect, vi } from "vitest";
import { reconstructState } from "./gameState.service";

process.env.MONGO_URI = "mongodb://localhost:27017/test";
process.env.GAME_TOKEN_PEPPER = "test-pepper";

const mockFindOne = vi.fn();
const mockFind = vi.fn().mockReturnValue({
	sort: () => ({
		lean: () => ({ exec: () => Promise.resolve([]) }),
	}),
});

vi.mock("../models/gameSession.model", () => ({
	GameSession: { findOne: (...args: unknown[]) => mockFindOne(...args) },
}));

vi.mock("../models/gameSnapshot.model", () => ({
	GameSnapshot: { findOne: (...args: unknown[]) => mockFindOne(...args) },
}));

vi.mock("../models/gameActionLog.model", () => ({
	GameActionLog: { find: () => mockFind() },
}));

describe("snapshot validation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockFindOne
			.mockImplementationOnce((query: { gameId?: string }) => ({
				lean: () => ({
					exec: () =>
						Promise.resolve(
							query.gameId
								? {
										gameId: query.gameId,
										seed: 1,
										mapGenVersion: 1,
										floorConfigs: [
											{ width: 50, height: 50, theme: "green_forest" },
										],
										latestSnapshotTurn: 0,
									}
								: null,
						),
				}),
			}))
			.mockImplementationOnce((query: { gameId?: string; turn?: number }) => ({
				lean: () => ({
					exec: () =>
						Promise.resolve(
							query.gameId && query.turn === 0
								? { gameId: query.gameId, turn: 0, state: null }
								: null,
						),
				}),
			}));
	});

	it("invalid snapshot state (missing or wrong shape) throws", async () => {
		// First findOne = session, second = snapshot with state: null (invalid)
		await expect(reconstructState("game-1")).rejects.toThrow();
	});

	it("invalid snapshot state (wrong type for turn) throws", async () => {
		mockFindOne
			.mockReset()
			.mockImplementationOnce((query: { gameId?: string }) => ({
				lean: () => ({
					exec: () =>
						Promise.resolve(
							query.gameId
								? {
										gameId: query.gameId,
										seed: 1,
										mapGenVersion: 1,
										floorConfigs: [
											{ width: 50, height: 50, theme: "green_forest" },
										],
										latestSnapshotTurn: 0,
									}
								: null,
						),
				}),
			}))
			.mockImplementationOnce(() => ({
				lean: () => ({
					exec: () =>
						Promise.resolve({
							gameId: "game-1",
							turn: 0,
							state: {
								turn: "not-a-number",
								heroId: "hero",
								heroFloorIndex: 0,
								floors: [],
								rngState: { algo: "xorshift32", s: 1 },
							},
						}),
				}),
			}));

		await expect(reconstructState("game-1")).rejects.toThrow();
	});
});
