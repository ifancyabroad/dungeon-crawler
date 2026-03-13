/**
 * Deterministic map generation: BSP (rooms + corridors) and cave (cellular automata).
 * Uses injected RNG only. Supports irregular playable shapes with void regions.
 */

import type { Rng } from "../rng";
import { TILE_TYPE } from "./config";
import type { GeneratedMap, MapGenConfig } from "./types";

/**
 * Builds a playable-shape mask: true = cell may be floor, false = void (always wall-bounded).
 * Uses value noise + radial falloff so edges tend to be void, then keeps the connected
 * component containing the map center so the playable area is one contiguous region.
 */
function buildShapeMask(width: number, height: number, voidTarget: number, rng: Rng): boolean[][] {
	const cx = (width - 1) / 2;
	const cy = (height - 1) / 2;
	const maxDist = Math.max(
		Math.hypot(cx, cy),
		Math.hypot(width - 1 - cx, cy),
		Math.hypot(cx, height - 1 - cy),
		Math.hypot(width - 1 - cx, height - 1 - cy),
		1,
	);

	// 1) Raw value noise [0, 1] in deterministic order
	const raw: number[][] = Array.from({ length: height }, () =>
		Array.from({ length: width }, () => rng()),
	);

	// 2) Light 2x2-style blur for slight coherence but keep edges rough (no full 3x3)
	const blur: number[][] = Array.from({ length: height }, () => Array(width).fill(0));
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			let sum = raw[y][x];
			let n = 1;
			for (const [dx, dy] of [
				[0, 1],
				[1, 0],
				[1, 1],
			]) {
				const nx = x + dx;
				const ny = y + dy;
				if (nx < width && ny < height) {
					sum += raw[ny][nx];
					n++;
				}
			}
			blur[y][x] = sum / n;
		}
	}

	// 3) Playable = value above threshold; threshold rises toward edges. Per-cell jitter adds roughness.
	const ROUGHNESS_JITTER = 0.28;
	const playableRaw: boolean[][] = Array.from({ length: height }, () => Array(width).fill(false));
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const dist = Math.hypot(x - cx, y - cy);
			const t = Math.max(0, 1 - dist / maxDist);
			const baseThreshold = 0.25 + (1 - t) * (0.4 + voidTarget * 0.6);
			const jitter = (rng() - 0.5) * ROUGHNESS_JITTER;
			playableRaw[y][x] = blur[y][x] > baseThreshold + jitter;
		}
	}

	// 4) Keep only connected component containing map center
	const scx = Math.floor(cx);
	const scy = Math.floor(cy);
	if (!playableRaw[scy][scx]) {
		playableRaw[scy][scx] = true;
	}
	const component = floodFillMask(playableRaw, scx, scy, width, height);
	const mask: boolean[][] = Array.from({ length: height }, () => Array(width).fill(false));
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			mask[y][x] = component.has(`${x},${y}`);
		}
	}
	return mask;
}

function floodFillMask(
	mask: boolean[][],
	startX: number,
	startY: number,
	w: number,
	h: number,
): Set<string> {
	const out = new Set<string>();
	const stack: [number, number][] = [[startX, startY]];
	while (stack.length > 0) {
		const [x, y] = stack.pop()!;
		const key = `${x},${y}`;
		if (out.has(key)) continue;
		if (x < 0 || x >= w || y < 0 || y >= h) continue;
		if (!mask[y][x]) continue;
		out.add(key);
		stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
	}
	return out;
}

const MIN_ROOM_WIDTH = 4;
const MIN_ROOM_HEIGHT = 4;
const MIN_LEAF_SIZE = MIN_ROOM_WIDTH + 2;

interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

function splitRect(rect: Rect, rng: Rng): { left: Rect; right: Rect } | null {
	if (rect.w < MIN_LEAF_SIZE * 2 && rect.h < MIN_LEAF_SIZE * 2) return null;
	const horizontal = rect.w >= rect.h && (rect.h < MIN_LEAF_SIZE * 2 || rng() < 0.5);
	if (horizontal && rect.w >= MIN_LEAF_SIZE * 2) {
		const min = MIN_LEAF_SIZE;
		const max = rect.w - MIN_LEAF_SIZE;
		const split = min + Math.floor(rng() * (max - min + 1));
		return {
			left: { x: rect.x, y: rect.y, w: split, h: rect.h },
			right: { x: rect.x + split, y: rect.y, w: rect.w - split, h: rect.h },
		};
	}
	if (!horizontal && rect.h >= MIN_LEAF_SIZE * 2) {
		const min = MIN_LEAF_SIZE;
		const max = rect.h - MIN_LEAF_SIZE;
		const split = min + Math.floor(rng() * (max - min + 1));
		return {
			left: { x: rect.x, y: rect.y, w: rect.w, h: split },
			right: { x: rect.x, y: rect.y + split, w: rect.w, h: rect.h - split },
		};
	}
	return null;
}

function roomFromLeaf(leaf: Rect, inset: number): Rect {
	return {
		x: leaf.x + inset,
		y: leaf.y + inset,
		w: Math.max(1, leaf.w - inset * 2),
		h: Math.max(1, leaf.h - inset * 2),
	};
}

function carveRoom(room: Rect, floor: Set<string>) {
	for (let y = room.y; y < room.y + room.h; y++) {
		for (let x = room.x; x < room.x + room.w; x++) {
			floor.add(`${x},${y}`);
		}
	}
}

function carveCorridor(
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	floor: Set<string>,
	corridor: Set<string>,
) {
	let x = x0;
	let y = y0;
	while (x !== x1) {
		floor.add(`${x},${y}`);
		corridor.add(`${x},${y}`);
		x += x1 > x ? 1 : -1;
	}
	while (y !== y1) {
		floor.add(`${x},${y}`);
		corridor.add(`${x},${y}`);
		y += y1 > y ? 1 : -1;
	}
	floor.add(`${x},${y}`);
	corridor.add(`${x},${y}`);
}

function getRoomCenter(room: Rect): { x: number; y: number } {
	return {
		x: room.x + (room.w >> 1),
		y: room.y + (room.h >> 1),
	};
}

function buildLeaves(rect: Rect, rng: Rng): Rect[] {
	const result: Rect[] = [];
	const splitResult = splitRect(rect, rng);
	if (!splitResult) {
		if (rect.w >= MIN_ROOM_WIDTH && rect.h >= MIN_ROOM_HEIGHT) {
			result.push(rect);
		}
		return result;
	}
	result.push(...buildLeaves(splitResult.left, rng));
	result.push(...buildLeaves(splitResult.right, rng));
	return result;
}

const CA_ITERATIONS = 5;
const CA_BIRTH_THRESHOLD = 4;

function countFloorNeighbors(grid: number[][], x: number, y: number, w: number, h: number): number {
	let n = 0;
	for (let dy = -1; dy <= 1; dy++) {
		for (let dx = -1; dx <= 1; dx++) {
			if (dx === 0 && dy === 0) continue;
			const nx = x + dx;
			const ny = y + dy;
			if (nx >= 0 && nx < w && ny >= 0 && ny < h && grid[ny][nx] === TILE_TYPE.FLOOR) n++;
		}
	}
	return n;
}

function floodFillFloor(
	grid: number[][],
	startX: number,
	startY: number,
	w: number,
	h: number,
): Set<string> {
	const out = new Set<string>();
	const stack: [number, number][] = [[startX, startY]];
	while (stack.length > 0) {
		const [x, y] = stack.pop()!;
		const key = `${x},${y}`;
		if (out.has(key)) continue;
		if (x < 0 || x >= w || y < 0 || y >= h) continue;
		if (grid[y][x] !== TILE_TYPE.FLOOR) continue;
		out.add(key);
		stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
	}
	return out;
}

/**
 * Cave generation: cellular automata for organic, cavern-like layouts with large open spaces.
 * Playable area is constrained to a noise-based mask; void regions are always wall.
 */
function generateCave(config: MapGenConfig, rng: Rng): GeneratedMap {
	const { width, height } = config;
	const mapCenterX = width / 2;
	const mapCenterY = height / 2;
	const voidTarget = Math.max(0.05, Math.min(0.45, config.shapeVoidTarget));
	const mask = buildShapeMask(width, height, voidTarget, rng);

	const ground: number[][] = Array.from({ length: height }, () =>
		Array.from({ length: width }, () => TILE_TYPE.FLOOR),
	);
	const wall: number[][] = Array.from({ length: height }, () =>
		Array.from({ length: width }, () => TILE_TYPE.WALL),
	);
	const pathLayer: number[][] = Array.from({ length: height }, () =>
		Array.from({ length: width }, () => 0),
	);

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (!mask[y][x]) ground[y][x] = TILE_TYPE.VOID;
		}
	}

	const floorChance = Math.max(0.35, Math.min(0.55, config.caveFloorChance));
	const inBounds = (x: number, y: number) => mask[y][x];

	// 1) Random fill (interior only; border / void stays wall)
	for (let y = 1; y < height - 1; y++) {
		for (let x = 1; x < width - 1; x++) {
			if (!inBounds(x, y)) continue;
			ground[y][x] = rng() < floorChance ? TILE_TYPE.FLOOR : TILE_TYPE.WALL;
		}
	}

	// 2) Cellular automata smoothing (void / out-of-mask count as wall for neighbors)
	for (let iter = 0; iter < CA_ITERATIONS; iter++) {
		const next = ground.map((row) => [...row]);
		for (let y = 1; y < height - 1; y++) {
			for (let x = 1; x < width - 1; x++) {
				if (!inBounds(x, y)) continue;
				const neighbors = countFloorNeighbors(ground, x, y, width, height);
				next[y][x] =
					neighbors >= CA_BIRTH_THRESHOLD ||
					(ground[y][x] === TILE_TYPE.FLOOR && neighbors >= 3)
						? TILE_TYPE.FLOOR
						: TILE_TYPE.WALL;
			}
		}
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				ground[y][x] = next[y][x];
			}
		}
	}

	// 3) Ensure border and shape boundary are wall
	for (let x = 0; x < width; x++) {
		ground[0][x] = !mask[0][x] ? TILE_TYPE.VOID : TILE_TYPE.WALL;
		ground[height - 1][x] = !mask[height - 1][x] ? TILE_TYPE.VOID : TILE_TYPE.WALL;
	}
	for (let y = 0; y < height; y++) {
		ground[y][0] = !mask[y][0] ? TILE_TYPE.VOID : TILE_TYPE.WALL;
		ground[y][width - 1] = !mask[y][width - 1] ? TILE_TYPE.VOID : TILE_TYPE.WALL;
	}
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (!mask[y][x]) ground[y][x] = TILE_TYPE.VOID;
		}
	}

	// 4) Keep only connected component containing map center (only through FLOOR)
	const cx = Math.floor(mapCenterX);
	const cy = Math.floor(mapCenterY);
	// Guarantee the seed cell is FLOOR so the flood fill always finds a component.
	if (mask[cy][cx] && ground[cy][cx] !== TILE_TYPE.FLOOR) {
		ground[cy][cx] = TILE_TYPE.FLOOR;
	}
	const component = floodFillFloor(ground, cx, cy, width, height);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (!component.has(`${x},${y}`)) {
				ground[y][x] = !mask[y][x] ? TILE_TYPE.VOID : TILE_TYPE.WALL;
			}
		}
	}

	// 5) Wall layer: EMPTY where playable (component), WALL elsewhere. Void keeps VOID ground.
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			wall[y][x] = component.has(`${x},${y}`) ? TILE_TYPE.EMPTY : TILE_TYPE.WALL;
		}
	}
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (ground[y][x] === TILE_TYPE.VOID) continue;
			ground[y][x] = TILE_TYPE.FLOOR;
		}
	}

	// 6) Spawn: cell in component closest to map center
	let bestDist = Infinity;
	let spawn = { x: cx, y: cy };
	for (const key of component) {
		const [x, y] = key.split(",").map(Number);
		const dx = x - mapCenterX;
		const dy = y - mapCenterY;
		const dist = dx * dx + dy * dy;
		if (dist < bestDist) {
			bestDist = dist;
			spawn = { x, y };
		}
	}
	return { ground, wall, spawn, pathLayer };
}

/**
 * Generates a dungeon map. Dispatches to BSP or cave based on config.algorithm.
 */
export function generateMap(config: MapGenConfig, rng: Rng): GeneratedMap {
	if (config.algorithm === "cave") {
		return generateCave(config, rng);
	}
	return generateBsp(config, rng);
}

/**
 * BSP: rooms in leaf regions connected by corridors. Ground FLOOR everywhere so walls sit on ground.
 * pathLayer marks corridor cells for path decoration. Spawn = room center nearest map center.
 * Cells outside the shape mask become void (ground VOID, wall WALL).
 */
function generateBsp(config: MapGenConfig, rng: Rng): GeneratedMap {
	const { width, height } = config;
	const mapCenterX = width / 2;
	const mapCenterY = height / 2;
	const voidTarget = Math.max(0.05, Math.min(0.45, config.shapeVoidTarget));
	const mask = buildShapeMask(width, height, voidTarget, rng);

	// Ground: FLOOR everywhere so walls always sit on a ground tile (void applied later)
	const ground: number[][] = Array.from({ length: height }, () =>
		Array.from({ length: width }, () => TILE_TYPE.FLOOR),
	);
	const wall: number[][] = Array.from({ length: height }, () =>
		Array.from({ length: width }, () => TILE_TYPE.WALL),
	);
	const pathLayer: number[][] = Array.from({ length: height }, () =>
		Array.from({ length: width }, () => 0),
	);

	const root: Rect = { x: 0, y: 0, w: width, h: height };
	const leaves = buildLeaves(root, rng);
	if (leaves.length === 0) {
		const cx = width >> 1;
		const cy = height >> 1;
		if (!mask[cy][cx]) {
			ground[cy][cx] = TILE_TYPE.VOID;
			wall[cy][cx] = TILE_TYPE.WALL;
			const fallback = findSpawnInMask(mask, width, height, mapCenterX, mapCenterY);
			wall[fallback.y][fallback.x] = TILE_TYPE.EMPTY;
			pathLayer[fallback.y][fallback.x] = 1;
			return { ground, wall, spawn: fallback, pathLayer };
		}
		wall[cy][cx] = TILE_TYPE.EMPTY;
		pathLayer[cy][cx] = 1;
		return { ground, wall, spawn: { x: cx, y: cy }, pathLayer };
	}

	const roomInset = Math.max(1, Math.min(3, config.bspRoomInset));
	const rooms = leaves.map((leaf) => roomFromLeaf(leaf, roomInset));
	const floor = new Set<string>();
	const corridor = new Set<string>();

	for (const room of rooms) {
		carveRoom(room, floor);
	}

	for (let i = 1; i < rooms.length; i++) {
		const a = getRoomCenter(rooms[i - 1]);
		const b = getRoomCenter(rooms[i]);
		carveCorridor(a.x, a.y, b.x, b.y, floor, corridor);
	}

	for (const key of floor) {
		const [x, y] = key.split(",").map(Number);
		if (y >= 0 && y < height && x >= 0 && x < width) {
			wall[y][x] = TILE_TYPE.EMPTY;
			if (corridor.has(key)) {
				pathLayer[y][x] = 1;
			}
		}
	}

	// Apply shape: void cells outside mask
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (!mask[y][x]) {
				ground[y][x] = TILE_TYPE.VOID;
				wall[y][x] = TILE_TYPE.WALL;
			}
		}
	}

	// Spawn: room center closest to map center that remains in mask (and is floor)
	let bestDist = Infinity;
	let spawn = getRoomCenter(rooms[0]);
	for (const room of rooms) {
		const c = getRoomCenter(room);
		if (!mask[c.y][c.x]) continue;
		const dx = c.x - mapCenterX;
		const dy = c.y - mapCenterY;
		const dist = dx * dx + dy * dy;
		if (dist < bestDist) {
			bestDist = dist;
			spawn = c;
		}
	}
	if (ground[spawn.y][spawn.x] === TILE_TYPE.VOID) {
		spawn = findSpawnInMask(mask, width, height, mapCenterX, mapCenterY);
	}
	return { ground, wall, spawn: { x: spawn.x, y: spawn.y }, pathLayer };
}

function findSpawnInMask(
	mask: boolean[][],
	width: number,
	height: number,
	centerX: number,
	centerY: number,
): { x: number; y: number } {
	let bestDist = Infinity;
	let best = { x: width >> 1, y: height >> 1 };
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (!mask[y][x]) continue;
			const dist = (x - centerX) ** 2 + (y - centerY) ** 2;
			if (dist < bestDist) {
				bestDist = dist;
				best = { x, y };
			}
		}
	}
	return best;
}
