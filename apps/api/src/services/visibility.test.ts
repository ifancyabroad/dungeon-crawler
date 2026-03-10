/**
 * Tests for symmetric shadow casting line-of-sight algorithm.
 */
import { describe, it, expect } from "vitest";
import { computeVisibility, computeOpacityMask, mergeExplored } from "@app/shared";

const WALL = 1; // TILE_TYPE.WALL
const EMPTY = -1; // TILE_TYPE.EMPTY

function makeWall(width: number, height: number, walls: [number, number][]): number[][] {
	const grid: number[][] = [];
	for (let y = 0; y < height; y++) {
		grid[y] = new Array(width).fill(EMPTY);
	}
	for (const [wx, wy] of walls) {
		grid[wy][wx] = WALL;
	}
	return grid;
}

describe("computeOpacityMask", () => {
	it("marks walls as opaque and non-walls as transparent", () => {
		const wall = makeWall(3, 3, [[1, 1]]);
		const mask = computeOpacityMask(wall, 3, 3);
		expect(mask[1 * 3 + 1]).toBe(1);
		expect(mask[0 * 3 + 0]).toBe(0);
	});
});

describe("computeVisibility", () => {
	it("origin is always visible", () => {
		const opacity = new Uint8Array(25);
		const vis = computeVisibility(2, 2, 5, 5, opacity, 8);
		expect(vis[2 * 5 + 2]).toBe(1);
	});

	it("sees all tiles in an open room within radius", () => {
		const w = 5,
			h = 5;
		const opacity = new Uint8Array(w * h);
		const vis = computeVisibility(2, 2, w, h, opacity, 8);
		for (let i = 0; i < w * h; i++) {
			expect(vis[i]).toBe(1);
		}
	});

	it("walls block vision behind them", () => {
		const w = 7,
			h = 1;
		const opacity = new Uint8Array(w * h);
		opacity[2] = 1;
		const vis = computeVisibility(0, 0, w, h, opacity, 8);
		expect(vis[0]).toBe(1);
		expect(vis[1]).toBe(1);
		expect(vis[2]).toBe(1); // the wall itself is visible
		expect(vis[3]).toBe(0);
		expect(vis[4]).toBe(0);
	});

	it("respects radius limit", () => {
		const w = 20,
			h = 1;
		const opacity = new Uint8Array(w * h);
		const vis = computeVisibility(0, 0, w, h, opacity, 3);
		expect(vis[0]).toBe(1);
		expect(vis[3]).toBe(1);
		expect(vis[4]).toBe(0);
	});

	it("can see around a corner when adjacent to wall edge", () => {
		const w = 5,
			h = 5;
		const wall = makeWall(w, h, [[2, 1]]);
		const opacity = computeOpacityMask(wall, w, h);
		const vis = computeVisibility(1, 1, w, h, opacity, 8);

		expect(vis[1 * w + 1]).toBe(1);
		expect(vis[1 * w + 2]).toBe(1);
		expect(vis[0 * w + 3]).toBe(1);
	});

	it("wall column blocks line of sight", () => {
		const w = 5,
			h = 5;
		const walls: [number, number][] = [
			[2, 0],
			[2, 1],
			[2, 2],
			[2, 3],
			[2, 4],
		];
		const wall = makeWall(w, h, walls);
		const opacity = computeOpacityMask(wall, w, h);
		const vis = computeVisibility(0, 2, w, h, opacity, 8);

		expect(vis[2 * w + 0]).toBe(1);
		expect(vis[2 * w + 1]).toBe(1);
		expect(vis[2 * w + 2]).toBe(1);
		expect(vis[2 * w + 3]).toBe(0);
		expect(vis[2 * w + 4]).toBe(0);
	});

	it("symmetry: if A sees B then B sees A", () => {
		const w = 9,
			h = 9;
		const walls: [number, number][] = [
			[4, 3],
			[5, 5],
		];
		const wall = makeWall(w, h, walls);
		const opacity = computeOpacityMask(wall, w, h);

		const visFromA = computeVisibility(1, 1, w, h, opacity, 8);
		const visFromB = computeVisibility(7, 7, w, h, opacity, 8);

		const idxA = 1 * w + 1;
		const idxB = 7 * w + 7;

		if (visFromA[idxB] === 1) {
			expect(visFromB[idxA]).toBe(1);
		}
		if (visFromB[idxA] === 1) {
			expect(visFromA[idxB]).toBe(1);
		}
	});
});

describe("mergeExplored", () => {
	it("marks newly visible tiles as explored", () => {
		const visible = new Uint8Array([0, 1, 1, 0]);
		const result = mergeExplored([], visible, 4);
		expect(result).toEqual([0, 1, 1, 0]);
	});

	it("preserves previously explored tiles", () => {
		const existing = [1, 0, 0, 1];
		const visible = new Uint8Array([0, 1, 0, 0]);
		const result = mergeExplored(existing, visible, 4);
		expect(result).toEqual([1, 1, 0, 1]);
	});

	it("handles empty existing array", () => {
		const visible = new Uint8Array([1, 0, 1]);
		const result = mergeExplored([], visible, 3);
		expect(result).toEqual([1, 0, 1]);
	});
});
