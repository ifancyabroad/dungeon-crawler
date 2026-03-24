/**
 * BSP (Binary Space Partition) map generation.
 * Recursively splits the map into leaf regions, carves a room in each, and connects them
 * with L-shaped corridors. Supports configurable room size ranges.
 */

import type { Rng } from "../../rng";
import { TILE_TYPE } from "../../config/map";
import type { FloorConfig, RawMap, BspParams } from "../types";
import { buildShapeMask, closestCell } from "./shared";

interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

function splitRect(rect: Rect, minLeaf: number, rng: Rng): { left: Rect; right: Rect } | null {
	if (rect.w < minLeaf * 2 && rect.h < minLeaf * 2) return null;
	const horizontal = rect.w >= rect.h && (rect.h < minLeaf * 2 || rng() < 0.5);
	if (horizontal && rect.w >= minLeaf * 2) {
		const min = minLeaf;
		const max = rect.w - minLeaf;
		const split = min + Math.floor(rng() * (max - min + 1));
		return {
			left: { x: rect.x, y: rect.y, w: split, h: rect.h },
			right: { x: rect.x + split, y: rect.y, w: rect.w - split, h: rect.h },
		};
	}
	if (!horizontal && rect.h >= minLeaf * 2) {
		const min = minLeaf;
		const max = rect.h - minLeaf;
		const split = min + Math.floor(rng() * (max - min + 1));
		return {
			left: { x: rect.x, y: rect.y, w: rect.w, h: split },
			right: { x: rect.x, y: rect.y + split, w: rect.w, h: rect.h - split },
		};
	}
	return null;
}

function buildLeaves(rect: Rect, minLeaf: number, minRoom: number, rng: Rng): Rect[] {
	const result: Rect[] = [];
	const split = splitRect(rect, minLeaf, rng);
	if (!split) {
		if (rect.w >= minRoom && rect.h >= minRoom) result.push(rect);
		return result;
	}
	result.push(...buildLeaves(split.left, minLeaf, minRoom, rng));
	result.push(...buildLeaves(split.right, minLeaf, minRoom, rng));
	return result;
}

function roomFromLeaf(leaf: Rect, params: BspParams, rng: Rng): Rect {
	const inset = params.roomInset;
	const maxW = Math.min(params.maxRoomSize, leaf.w - inset * 2);
	const maxH = Math.min(params.maxRoomSize, leaf.h - inset * 2);
	const minW = Math.min(params.minRoomSize, maxW);
	const minH = Math.min(params.minRoomSize, maxH);
	const rw = minW + Math.floor(rng() * (maxW - minW + 1));
	const rh = minH + Math.floor(rng() * (maxH - minH + 1));
	const rx = leaf.x + inset + Math.floor(rng() * Math.max(1, leaf.w - inset * 2 - rw + 1));
	const ry = leaf.y + inset + Math.floor(rng() * Math.max(1, leaf.h - inset * 2 - rh + 1));
	return { x: rx, y: ry, w: Math.max(1, rw), h: Math.max(1, rh) };
}

function carveRoom(room: Rect, floor: Set<string>): void {
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

function roomCenter(room: Rect): { x: number; y: number } {
	return { x: room.x + (room.w >> 1), y: room.y + (room.h >> 1) };
}

export function generateBsp(config: FloorConfig, rng: Rng): RawMap {
	const { width, height } = config;
	const params = config.algorithmParams as BspParams;
	const voidTarget = Math.max(0.05, Math.min(0.45, config.shapeVoidTarget));
	const mask = buildShapeMask(width, height, voidTarget, rng);
	const cx = width / 2;
	const cy = height / 2;

	const ground: number[][] = Array.from({ length: height }, () =>
		Array(width).fill(TILE_TYPE.FLOOR),
	);
	const wall: number[][] = Array.from({ length: height }, () =>
		Array(width).fill(TILE_TYPE.WALL),
	);
	const pathLayer: number[][] = Array.from({ length: height }, () => Array(width).fill(0));

	const minRoom = Math.max(3, params.minRoomSize);
	const minLeaf = minRoom + params.roomInset * 2;

	const leaves = buildLeaves({ x: 0, y: 0, w: width, h: height }, minLeaf, minRoom, rng);
	const rooms = leaves.map((l) => roomFromLeaf(l, params, rng));
	const floor = new Set<string>();
	const corridor = new Set<string>();

	for (const room of rooms) carveRoom(room, floor);

	for (let i = 1; i < rooms.length; i++) {
		const a = roomCenter(rooms[i - 1]);
		const b = roomCenter(rooms[i]);
		carveCorridor(a.x, a.y, b.x, b.y, floor, corridor);
	}

	for (const key of floor) {
		const comma = key.indexOf(",");
		const x = +key.slice(0, comma);
		const y = +key.slice(comma + 1);
		if (x >= 0 && x < width && y >= 0 && y < height) {
			wall[y][x] = TILE_TYPE.EMPTY;
			if (corridor.has(key)) pathLayer[y][x] = 1;
		}
	}

	// Apply shape mask (corridors survive — they keep rooms reachable)
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (!mask[y][x] && !floor.has(`${x},${y}`)) {
				ground[y][x] = TILE_TYPE.VOID;
				wall[y][x] = TILE_TYPE.WALL;
			}
		}
	}

	// Spawn: room center closest to map center
	let bestDist = Infinity;
	let spawn: { x: number; y: number } | null = null;
	for (const room of rooms) {
		const c = roomCenter(room);
		if (wall[c.y]?.[c.x] !== TILE_TYPE.EMPTY) continue;
		const dist = (c.x - cx) ** 2 + (c.y - cy) ** 2;
		if (dist < bestDist) {
			bestDist = dist;
			spawn = c;
		}
	}
	if (!spawn) spawn = closestCell(floor, cx, cy);

	return { ground, wall, spawn, pathLayer, shapeMask: mask };
}
