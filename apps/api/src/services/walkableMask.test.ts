/**
 * Lightweight tests for canonical walkability mask: length and applyAction(move) consistency.
 */

import { describe, it, expect } from "vitest";
import {
	applyAction,
	computeOpacityMask,
	computeWalkableMaskForFloor,
	createActionContext,
	createInitialState,
	DEFAULT_FLOOR_CONFIG,
	getHero,
	regenerateBaseMaps,
	MAP_GEN_VERSION,
	xyToIdx,
} from "@app/shared";

describe("walkable mask", () => {
	const seed = 42;
	const width = 10;
	const height = 8;
	const floorConfig = { ...DEFAULT_FLOOR_CONFIG, width, height, theme: "dungeon" };

	it("computeWalkableMaskForFloor returns mask of length width*height", () => {
		const baseLayers = regenerateBaseMaps(seed, [floorConfig], MAP_GEN_VERSION);
		const base = baseLayers[0]!;
		const mask = computeWalkableMaskForFloor(base, {});
		expect(mask).toBeInstanceOf(Uint8Array);
		expect(mask.length).toBe(width * height);
	});

	it("applyAction(move) uses mask[idx] consistently", () => {
		const state = createInitialState(seed, floorConfig);
		const baseLayers = regenerateBaseMaps(seed, [floorConfig], MAP_GEN_VERSION);
		const base = baseLayers[0]!;
		const mask = computeWalkableMaskForFloor(base, state.floors[0]!.state.tileOverrides ?? {});

		const opacityMask = computeOpacityMask(base.wall, width, height);
		const context = createActionContext([mask], [opacityMask]);

		const heroBefore = getHero(state);
		expect(heroBefore).toBeDefined();
		const idxBefore = heroBefore!.idx;

		const targetIdx = idxBefore + 1;
		const result = applyAction(state, { type: "move", direction: "right" }, context);

		if (mask[targetIdx] === 1) {
			expect(result.ok).toBe(true);
			if (result.ok) {
				const heroAfter = getHero(result.state);
				expect(heroAfter!.idx).toBe(targetIdx);
			}
		} else {
			expect(result.ok).toBe(false);
			if (!result.ok) expect(result.reason).toBe("move_blocked");
		}
	});
});
