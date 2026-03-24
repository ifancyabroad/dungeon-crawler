import { describe, it, expect } from "vitest";
import {
	ActionSchema,
	applyAction,
	computeOpacityMask,
	computeWalkableMaskForFloor,
	createActionContext,
	createInitialState,
	DEFAULT_FLOOR_CONFIG,
	DEFAULT_HERO_INIT,
	regenerateBaseMaps,
	MAP_GEN_VERSION,
} from "../index";

describe("walkable mask", () => {
	const seed = 42;
	const width = 10;
	const height = 8;
	const floorConfig = { ...DEFAULT_FLOOR_CONFIG, width, height, theme: "green_forest" as const };

	it("builds walkability mask aligned with floor size", () => {
		const base = regenerateBaseMaps(seed, [floorConfig], MAP_GEN_VERSION)[0]!;
		const mask = computeWalkableMaskForFloor(base, {});
		expect(mask).toBeInstanceOf(Uint8Array);
		expect(mask.length).toBe(width * height);
	});

	it("move into known walkable neighbor advances exactly one turn", () => {
		const state = createInitialState(seed, [floorConfig], DEFAULT_HERO_INIT);
		const base = regenerateBaseMaps(seed, [floorConfig], MAP_GEN_VERSION)[0]!;
		const mask = computeWalkableMaskForFloor(base, state.floors[0]!.state.tileOverrides ?? {});
		const opacityMask = computeOpacityMask(base.wall, width, height);
		const context = createActionContext([mask], [opacityMask]);
		const directions = ["up", "down", "left", "right"] as const;
		const result = directions
			.map((direction) =>
				applyAction(state, ActionSchema.parse({ type: "move", direction }), context),
			)
			.find((candidate) => candidate.ok);
		expect(result).toBeDefined();
		if (!result || !result.ok) return;
		expect(result.state.turn).toBe(state.turn + 1);
	});
});
