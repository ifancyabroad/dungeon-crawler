/**
 * Hybrid map generation: CA-carved outer cave shape with BSP rooms stamped inside.
 * Produces a natural cave outline with structured interior rooms connected by corridors.
 */

import type { Rng } from "../../rng";
import { TILE_TYPE } from "../config";
import type { FloorConfig, RawMap, HybridParams } from "../types";
import { buildShapeMask, floodFillFloor, countFloorNeighbors, closestCell } from "./shared";

interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

function carveRect(rect: Rect, floor: Set<string>): void {
	for (let y = rect.y; y < rect.y + rect.h; y++) {
		for (let x = rect.x; x < rect.x + rect.w; x++) {
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
): void {
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

export function generateHybrid(config: FloorConfig, rng: Rng): RawMap {
	const { width, height } = config;
	const params = config.algorithmParams as HybridParams;
	const voidTarget = Math.max(0.05, Math.min(0.45, config.shapeVoidTarget));
	const mask = buildShapeMask(width, height, voidTarget, rng);
	const cx = Math.floor(width / 2);
	const cy = Math.floor(height / 2);

	// --- Phase 1: CA-carved cave shell ---
	const ground: number[][] = Array.from({ length: height }, () =>
		Array(width).fill(TILE_TYPE.FLOOR),
	);
	const wall: number[][] = Array.from({ length: height }, () =>
		Array(width).fill(TILE_TYPE.WALL),
	);
	const pathLayer: number[][] = Array.from({ length: height }, () => Array(width).fill(0));

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (!mask[y][x]) ground[y][x] = TILE_TYPE.VOID;
		}
	}

	const floorChance = Math.max(0.35, Math.min(0.55, params.caveFloorChance));

	for (let y = 1; y < height - 1; y++) {
		for (let x = 1; x < width - 1; x++) {
			if (!mask[y][x]) continue;
			ground[y][x] = rng() < floorChance ? TILE_TYPE.FLOOR : TILE_TYPE.WALL;
		}
	}

	// 4 iterations of CA for a rougher, less smoothed cave shell
	for (let iter = 0; iter < 4; iter++) {
		const next = ground.map((row) => [...row]);
		for (let y = 1; y < height - 1; y++) {
			for (let x = 1; x < width - 1; x++) {
				if (!mask[y][x]) continue;
				const n = countFloorNeighbors(ground, x, y, width, height, TILE_TYPE.FLOOR);
				next[y][x] =
					n >= 4 || (ground[y][x] === TILE_TYPE.FLOOR && n >= 3)
						? TILE_TYPE.FLOOR
						: TILE_TYPE.WALL;
			}
		}
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) ground[y][x] = next[y][x];
		}
	}

	// Border enforcement
	for (let x = 0; x < width; x++) {
		ground[0][x] = !mask[0][x] ? TILE_TYPE.VOID : TILE_TYPE.WALL;
		ground[height - 1][x] = !mask[height - 1][x] ? TILE_TYPE.VOID : TILE_TYPE.WALL;
	}
	for (let y = 0; y < height; y++) {
		ground[y][0] = !mask[y][0] ? TILE_TYPE.VOID : TILE_TYPE.WALL;
		ground[y][width - 1] = !mask[y][width - 1] ? TILE_TYPE.VOID : TILE_TYPE.WALL;
		for (let x = 0; x < width; x++) {
			if (!mask[y][x]) ground[y][x] = TILE_TYPE.VOID;
		}
	}

	if (mask[cy][cx] && ground[cy][cx] !== TILE_TYPE.FLOOR) ground[cy][cx] = TILE_TYPE.FLOOR;
	const caveComponent = floodFillFloor(ground, cx, cy, width, height, TILE_TYPE.FLOOR);

	// --- Phase 2: Stamp BSP rooms inside the cave ---
	const roomCount = Math.max(1, params.roomCount);
	const inset = Math.max(1, params.roomInset);
	const minRoomSide = 4;

	// Collect open floor cells from the cave as room candidate centers
	const caveCells = [...caveComponent].map((k) => {
		const comma = k.indexOf(",");
		return { x: +k.slice(0, comma), y: +k.slice(comma + 1) };
	});

	const rooms: Rect[] = [];
	const floorSet = new Set<string>(caveComponent);
	const corridorSet = new Set<string>();

	// Place rooms at random cave positions
	const shuffled = caveCells.slice().sort(() => rng() - 0.5);
	for (const cell of shuffled) {
		if (rooms.length >= roomCount) break;
		const rw = minRoomSide + Math.floor(rng() * 5);
		const rh = minRoomSide + Math.floor(rng() * 5);
		const rx = cell.x - Math.floor(rw / 2);
		const ry = cell.y - Math.floor(rh / 2);
		if (rx < inset || ry < inset || rx + rw > width - inset || ry + rh > height - inset)
			continue;
		// Only stamp if center is in the cave
		if (!caveComponent.has(`${cell.x},${cell.y}`)) continue;
		rooms.push({ x: rx, y: ry, w: rw, h: rh });
		carveRect({ x: rx, y: ry, w: rw, h: rh }, floorSet);
	}

	// Connect rooms with corridors
	for (let i = 1; i < rooms.length; i++) {
		const a = rooms[i - 1];
		const b = rooms[i];
		const ax = a.x + (a.w >> 1);
		const ay = a.y + (a.h >> 1);
		const bx = b.x + (b.w >> 1);
		const by = b.y + (b.h >> 1);
		carveCorridor(ax, ay, bx, by, floorSet, corridorSet);
	}

	// Apply floor set to wall layer
	for (const key of floorSet) {
		const comma = key.indexOf(",");
		const x = +key.slice(0, comma);
		const y = +key.slice(comma + 1);
		if (x >= 0 && x < width && y >= 0 && y < height) {
			wall[y][x] = TILE_TYPE.EMPTY;
			if (corridorSet.has(key)) pathLayer[y][x] = 1;
		}
	}

	// Prune cells outside mask that were not in the cave or carved rooms
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (!floorSet.has(`${x},${y}`)) {
				ground[y][x] = !mask[y][x] ? TILE_TYPE.VOID : TILE_TYPE.WALL;
				wall[y][x] = TILE_TYPE.WALL;
			} else {
				ground[y][x] = TILE_TYPE.FLOOR;
			}
		}
	}

	const spawn = closestCell(floorSet, cx, cy);
	return { ground, wall, spawn, pathLayer, shapeMask: mask };
}
