/**
 * Room analysis: flood-fill detection and classification of distinct regions in a generated map.
 *
 * Rooms are classified by area and connectivity:
 * - chamber:  large open room (non-corridor region, area >= CHAMBER_THRESHOLD)
 * - alcove:   small dead-end (non-corridor, 1 connection, area < CHAMBER_THRESHOLD)
 * - treasure: promoted dead-end based on specialRoomFrequency
 * - corridor: narrow connecting passage (all degree ≤ 2 regions, any length)
 * - generic:  everything else
 *
 * Tags "start", "exit", and "boss" are assigned externally (by baseLayers.ts) after spawn/exit selection.
 *
 * Determinism: rooms are sorted by center index before any RNG is consumed.
 */

import { TILE_TYPE } from "../config/map";
import type { Rng } from "../rng";
import type { AnalyzedRoom, FloorConfig, RawMap, RoomTag } from "./types";

const CHAMBER_THRESHOLD = 30;
const CONNECT_SAMPLE_DIRECTIONS = [
	[1, 0],
	[-1, 0],
	[0, 1],
	[0, -1],
] as const;

/**
 * Detect all distinct open regions in `rawMap` via flood fill and classify each one.
 * Returns the list of rooms sorted by `center` (stable, deterministic key).
 */
export function analyzeRooms(rawMap: RawMap, config: FloorConfig, rng: Rng): AnalyzedRoom[] {
	const { ground, wall } = rawMap;
	const height = ground.length;
	const width = ground[0]?.length ?? 0;
	const totalCells = width * height;

	// --- 1. Compute open-cell degree and split the open graph by corridor-vs-room morphology ---
	const openMask = new Uint8Array(totalCells);
	const degrees = new Uint8Array(totalCells);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const idx = y * width + x;
			if (!isOpen(ground, wall, x, y)) continue;
			openMask[idx] = 1;
			let degree = 0;
			for (const [dx, dy] of CONNECT_SAMPLE_DIRECTIONS) {
				const nx = x + dx;
				const ny = y + dy;
				if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
				if (isOpen(ground, wall, nx, ny)) degree++;
			}
			degrees[idx] = degree;
		}
	}

	const regionMap: Int32Array = new Int32Array(totalCells).fill(-1);
	let nextId = 0;
	const regionCells: number[][] = [];
	const regionIsCorridor: boolean[] = [];

	// Pre-seed explicit BSP room rectangles as their own regions.
	// This is critical for BSP and hybrid maps: degree-based flood fill excludes
	// degree-2 corner cells, so room regions would miss them without pre-seeding.
	// It also prevents BSP room interiors from merging into one giant cave region
	// on hybrid maps, which would leave no separate boss room candidates.
	if (rawMap.bspRooms.length > 0) {
		for (const room of rawMap.bspRooms) {
			const cells: number[] = [];
			for (let ry = room.y; ry < room.y + room.h; ry++) {
				for (let rx = room.x; rx < room.x + room.w; rx++) {
					if (rx < 0 || rx >= width || ry < 0 || ry >= height) continue;
					const idx = ry * width + rx;
					if (openMask[idx] !== 1 || regionMap[idx] !== -1) continue;
					regionMap[idx] = nextId;
					cells.push(idx);
				}
			}
			if (cells.length > 0) {
				regionCells.push(cells);
				regionIsCorridor.push(false); // BSP rooms are never corridors
				nextId++;
			}
		}
	}

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const idx = y * width + x;
			if (regionMap[idx] !== -1) continue;
			if (openMask[idx] !== 1) continue;

			const isCorridorRegion = degrees[idx] <= 2;
			const id = nextId++;
			regionCells.push([]);
			regionIsCorridor.push(isCorridorRegion);
			const stack: number[] = [idx];
			while (stack.length > 0) {
				const cur = stack.pop()!;
				if (regionMap[cur] !== -1) continue;
				if (openMask[cur] !== 1) continue;
				if (degrees[cur] <= 2 !== isCorridorRegion) continue;
				regionMap[cur] = id;
				regionCells[id].push(cur);
				const cx = cur % width;
				const cy = Math.floor(cur / width);
				for (const [dx, dy] of CONNECT_SAMPLE_DIRECTIONS) {
					const nx = cx + dx;
					const ny = cy + dy;
					if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
					const nIdx = ny * width + nx;
					if (regionMap[nIdx] !== -1) continue;
					if (openMask[nIdx] !== 1) continue;
					if (degrees[nIdx] <= 2 !== isCorridorRegion) continue;
					stack.push(nIdx);
				}
			}
		}
	}

	if (regionCells.length === 0) return [];

	// --- 2. Compute centroid and connections for each region ---
	const rooms: AnalyzedRoom[] = regionCells.map((cells, id) => {
		const center = computeCenter(cells, width);
		return {
			id,
			cells,
			center,
			area: cells.length,
			tag: "generic" as RoomTag,
			connections: [],
		};
	});

	// Build adjacency: two regions are connected if they share a border wall cell
	// (i.e., floor cells in different regions that are 4-adjacent to each other)
	const connectionSet: Set<string>[] = rooms.map(() => new Set<string>());
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const idx = y * width + x;
			if (openMask[idx] !== 1) continue;
			const aId = regionMap[idx];
			for (const [dx, dy] of CONNECT_SAMPLE_DIRECTIONS) {
				const nx = x + dx;
				const ny = y + dy;
				if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
				const nIdx = ny * width + nx;
				if (openMask[nIdx] !== 1) continue;
				const bId = regionMap[nIdx];
				if (bId !== aId) {
					connectionSet[aId].add(String(bId));
					connectionSet[bId].add(String(aId));
				}
			}
		}
	}
	for (const room of rooms) {
		room.connections = [...connectionSet[room.id]].map(Number).sort((a, b) => a - b);
	}

	// --- 3. Sort by center for determinism before consuming RNG ---
	rooms.sort((a, b) => a.center - b.center);

	// --- 4. Classify ---
	const specialFreq = Math.max(0, Math.min(1, config.specialRoomFrequency));
	for (const room of rooms) {
		const isCorridor = regionIsCorridor[room.id] ?? false;
		if (isCorridor) {
			// All degree-≤-2 regions are narrow passages regardless of length.
			// A 40-cell straight corridor is still a corridor.
			room.tag = "corridor";
			continue;
		}
		if (room.area >= CHAMBER_THRESHOLD) {
			room.tag = "chamber";
		} else if (room.connections.length <= 1) {
			// Dead-end: alcove unless promoted to treasure
			if (rng() < specialFreq) {
				room.tag = "treasure";
			} else {
				room.tag = "alcove";
			}
		} else {
			room.tag = "generic";
		}
	}

	return rooms;
}

function isOpen(ground: number[][], wall: number[][], x: number, y: number): boolean {
	return ground[y]?.[x] === TILE_TYPE.FLOOR && wall[y]?.[x] !== TILE_TYPE.WALL;
}

/** Find the cell in the list closest to the centroid. Returns as flat index. */
function computeCenter(cells: number[], width: number): number {
	let sumX = 0;
	let sumY = 0;
	for (const idx of cells) {
		sumX += idx % width;
		sumY += Math.floor(idx / width);
	}
	const cx = sumX / cells.length;
	const cy = sumY / cells.length;

	let bestDist = Infinity;
	let best = cells[0] ?? 0;
	for (const idx of cells) {
		const x = idx % width;
		const y = Math.floor(idx / width);
		const dist = (x - cx) ** 2 + (y - cy) ** 2;
		if (dist < bestDist) {
			bestDist = dist;
			best = idx;
		}
	}
	return best;
}
