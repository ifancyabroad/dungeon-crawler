/**
 * Tests for symmetric shadow casting line-of-sight algorithm.
 */
import { describe, it, expect } from "vitest";
import { computeVisibility, computeOpacityMask, mergeExplored } from "../index";

const WALL = 1;
const EMPTY = -1;

function makeWall(width: number, height: number, walls: [number, number][]): number[][] {
	const grid: number[][] = [];
	for (let y = 0; y < height; y++) grid[y] = new Array(width).fill(EMPTY);
	for (const [wx, wy] of walls) grid[wy][wx] = WALL;
	return grid;
}

describe("computeOpacityMask", () => {
	it("marks walls as opaque and non-walls as transparent", () => {
		const wall = makeWall(3, 3, [[1, 1]]);
		const mask = computeOpacityMask(wall, 3, 3);
		expect(mask[1 * 3 + 1]).toBe(1);
		expect(mask[0]).toBe(0);
	});
});

describe("computeVisibility", () => {
	it("origin is always visible", () => {
		const opacity = new Uint8Array(25);
		const vis = computeVisibility(2, 2, 5, 5, opacity, 8);
		expect(vis[2 * 5 + 2]).toBe(1);
	});

	it("sees all tiles in an open room within radius", () => {
		const w = 5;
		const h = 5;
		const opacity = new Uint8Array(w * h);
		const vis = computeVisibility(2, 2, w, h, opacity, 8);
		for (let i = 0; i < w * h; i++) expect(vis[i]).toBe(1);
	});

	it("walls block vision behind them", () => {
		const w = 7;
		const h = 1;
		const opacity = new Uint8Array(w * h);
		opacity[2] = 1;
		const vis = computeVisibility(0, 0, w, h, opacity, 8);
		expect(vis[0]).toBe(1);
		expect(vis[1]).toBe(1);
		expect(vis[2]).toBe(1);
		expect(vis[3]).toBe(0);
	});

	it("respects radius limit", () => {
		const w = 20;
		const h = 1;
		const opacity = new Uint8Array(w * h);
		const vis = computeVisibility(0, 0, w, h, opacity, 3);
		expect(vis[3]).toBe(1);
		expect(vis[4]).toBe(0);
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
});
