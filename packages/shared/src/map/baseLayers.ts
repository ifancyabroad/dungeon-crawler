/**
 * Regenerate base map layers from seed + floor configs (deterministic).
 *
 * Pipeline per floor:
 *   1. Generate raw map shape (generate.ts)
 *   2. Room analysis (roomAnalysis.ts)
 *   3. Vault injection (vaultInjector.ts)  ← must run before water/decoration
 *   4. Water mask (buildWaterMask) + clear water over vault footprints
 *   5. Scatter decoration (buildDecorationLayer) → produces initial blockedMask
 *   6. Apply vault collision cells to blockedMask
 *   7. Spawn / exit point selection
 *
 * All stages share a single Rng per floor (seed = gameSeed + floorIndex).
 * Vault defs are passed in from the API layer so @app/shared never imports @app/content.
 */

import { createRng } from "../rng";
import { buildDecorationLayer } from "./decorations";
import { generateMap } from "./generate";
import { buildWaterMask } from "./water";
import { isCellWalkable } from "./walkability";
import { analyzeRooms } from "./roomAnalysis";
import { injectVaults } from "./vaultInjector";
import { MAP_GEN_VERSION, TILE_TYPE } from "../config/map";
import type { FloorConfig, RawMap, VaultDef, AnalyzedRoom, VaultPlacement } from "./types";

export interface BaseLayerFloor {
	ground: number[][];
	wall: number[][];
	blockedMask: boolean[][];
	/** Water cells — needed by client to distinguish water vs ground tiles when rendering. */
	waterMask: boolean[][];
	/** Logical decoration type per cell (e.g. "rock", "grass", ""). Used by client for tile mapping. */
	decorationGrid: string[][];
	width: number;
	height: number;
	/** Flat tile index of the hero spawn point. */
	spawnIdx: number;
	/** Flat tile index of the exit to the next floor. -1 for the last floor (no exit). */
	exitIdx: number;
	/** Analyzed room data produced during generation. Used by encounter placement. */
	rooms: AnalyzedRoom[];
	/** Vault placements that were stamped onto this floor. */
	vaultPlacements: VaultPlacement[];
}

export interface RegenerateOptions {
	/** Vault definitions from @app/content. Pass [] to skip vault injection. Accepts readonly arrays. */
	vaultDefs?: readonly VaultDef[];
}

const MIN_FLOOR_SIDE = 7;

interface ReachabilityResult {
	reachable: Set<number>;
	distances: Int32Array;
}

function validateFloorConfig(config: FloorConfig): void {
	if (config.width < MIN_FLOOR_SIDE || config.height < MIN_FLOOR_SIDE) {
		throw new Error(
			`Invalid floor dimensions ${config.width}x${config.height}; minimum is ${MIN_FLOOR_SIDE}x${MIN_FLOOR_SIDE}`,
		);
	}
}

function computeReachability(
	ground: number[][],
	wall: number[][],
	blockedMask: boolean[][],
	spawnIdx: number,
	width: number,
	height: number,
): ReachabilityResult {
	const distances = new Int32Array(width * height).fill(-1);
	const reachable = new Set<number>();
	const sx = spawnIdx % width;
	const sy = Math.floor(spawnIdx / width);
	if (!isCellWalkable(ground, wall, blockedMask, sx, sy)) return { reachable, distances };
	const queue: number[] = [spawnIdx];
	distances[spawnIdx] = 0;
	for (let head = 0; head < queue.length; head++) {
		const idx = queue[head];
		reachable.add(idx);
		const x = idx % width;
		const y = Math.floor(idx / width);
		for (const [dx, dy] of [
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1],
		] as const) {
			const nx = x + dx;
			const ny = y + dy;
			if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
			const nIdx = ny * width + nx;
			if (distances[nIdx] !== -1) continue;
			if (!isCellWalkable(ground, wall, blockedMask, nx, ny)) continue;
			distances[nIdx] = distances[idx] + 1;
			queue.push(nIdx);
		}
	}
	return { reachable, distances };
}

function countWalkableCells(
	ground: number[][],
	wall: number[][],
	blockedMask: boolean[][],
	width: number,
	height: number,
): number {
	let count = 0;
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (isCellWalkable(ground, wall, blockedMask, x, y)) count++;
		}
	}
	return count;
}

/**
 * Find the walkable tile farthest from the spawn point by reachable path distance.
 * Returns -1 if no reachable tile is found.
 */
export function findExitIdx(
	ground: number[][],
	wall: number[][],
	blockedMask: boolean[][],
	spawnIdx: number,
	width: number,
	height: number,
): number {
	const { reachable, distances } = computeReachability(
		ground,
		wall,
		blockedMask,
		spawnIdx,
		width,
		height,
	);
	if (reachable.size === 0) return -1;
	let bestIdx = -1;
	let bestDist = -1;
	for (const idx of reachable) {
		if (idx === spawnIdx) continue;
		const dist = distances[idx];
		if (dist > bestDist) {
			bestDist = dist;
			bestIdx = idx;
		}
	}
	return bestIdx >= 0 ? bestIdx : spawnIdx;
}

/**
 * Find the nearest walkable cell to (originX, originY) by expanding outward in rings.
 * Returns undefined if no walkable cell is found within the map bounds.
 */
function findNearestWalkable(
	ground: number[][],
	wall: number[][],
	blockedMask: boolean[][],
	originX: number,
	originY: number,
	width: number,
	height: number,
): number | undefined {
	if (isCellWalkable(ground, wall, blockedMask, originX, originY))
		return originY * width + originX;
	for (let radius = 1; radius < Math.max(width, height); radius++) {
		for (let dy = -radius; dy <= radius; dy++) {
			for (let dx = -radius; dx <= radius; dx++) {
				if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
				const x = originX + dx;
				const y = originY + dy;
				if (x < 0 || x >= width || y < 0 || y >= height) continue;
				if (isCellWalkable(ground, wall, blockedMask, x, y)) return y * width + x;
			}
		}
	}
	return undefined;
}

/**
 * Tag the start and exit rooms in the analyzed room list.
 * The room containing spawnIdx is tagged "start"; the one containing exitIdx is tagged "exit".
 * Modifies rooms in place.
 */
function tagSpawnAndExitRooms(rooms: AnalyzedRoom[], spawnIdx: number, exitIdx: number): void {
	for (const room of rooms) {
		if (room.cells.includes(spawnIdx)) {
			room.tag = "start";
		}
		if (exitIdx >= 0 && room.cells.includes(exitIdx) && room.tag !== "start") {
			room.tag = "exit";
		}
	}
}

/**
 * Deterministic regeneration of all floor base layers from seed + configs.
 * The last floor gets exitIdx = -1 (no exit).
 *
 * @param vaultDefs  Optional vault definitions. Sorted by id internally for determinism.
 */
export function regenerateBaseMaps(
	seed: number,
	floorConfigs: FloorConfig[],
	mapGenVersion: number,
	options: RegenerateOptions = {},
): BaseLayerFloor[] {
	if (mapGenVersion !== MAP_GEN_VERSION) {
		throw new Error(`Unsupported mapGenVersion: ${mapGenVersion}`);
	}

	const vaultDefs = (options.vaultDefs ?? [])
		.slice()
		.sort((a, b) => a.id.localeCompare(b.id, "en")) as VaultDef[];
	const result: BaseLayerFloor[] = [];
	const lastFloorIndex = floorConfigs.length - 1;

	for (let i = 0; i < floorConfigs.length; i++) {
		const config = floorConfigs[i];
		validateFloorConfig(config);
		const rng = createRng(seed + i);

		// Stage 1: algorithm
		const rawMap: RawMap = generateMap(config, rng);
		const { ground, wall, spawn, pathLayer } = rawMap;
		const width = config.width;
		const height = config.height;

		// Stage 2: room analysis
		const roomsForVaults = analyzeRooms(rawMap, config, rng);

		// Stage 3: vault injection — must run before water/decoration so those
		// stages see the final terrain (vault walls, vault floor cells).
		let vaultPlacements: VaultPlacement[] = [];
		if (vaultDefs.length > 0 && config.vaultIds.length > 0) {
			vaultPlacements = injectVaults(rawMap, roomsForVaults, vaultDefs, config, rng);
		}

		// Stage 4: water mask — runs on post-vault terrain
		const waterMask = config.waterEnabled
			? buildWaterMask(ground, wall, spawn, seed + i)
			: (Array.from({ length: height }, () => Array(width).fill(false)) as boolean[][]);

		// Clear any water cells that fall inside a vault's stamped footprint.
		// buildWaterMask has no knowledge of vault placements, so water can
		// seed into vault cells. Vault terrain must win.
		for (const placement of vaultPlacements) {
			const ox = placement.originIdx % width;
			const oy = Math.floor(placement.originIdx / width);
			const vaultDef = vaultDefs.find((v) => v.id === placement.vaultId);
			if (!vaultDef) continue;
			for (let vy = 0; vy < vaultDef.height; vy++) {
				for (let vx = 0; vx < vaultDef.width; vx++) {
					const mx = ox + vx;
					const my = oy + vy;
					if (my >= 0 && my < height && mx >= 0 && mx < width) {
						waterMask[my][mx] = false;
					}
				}
			}
		}

		// Stage 5: scatter decoration — runs on post-vault terrain; produces initial blockedMask
		const { blockedMask, decorationGrid } = buildDecorationLayer(
			ground,
			wall,
			pathLayer,
			waterMask,
			spawn,
			seed + i,
			config.decorationWeights,
			config.scatterChance,
		);

		// Stage 6: apply vault collision cells to blockedMask
		for (const placement of vaultPlacements) {
			for (const flatIdx of placement.collisionCells) {
				const x = flatIdx % width;
				const y = Math.floor(flatIdx / width);
				blockedMask[y][x] = true;
			}
		}

		// Stage 7: relocate spawn if vault injection placed a collision tile on it
		let safeSpawnIdx = findNearestWalkable(
			ground,
			wall,
			blockedMask,
			spawn.x,
			spawn.y,
			width,
			height,
		);
		if (safeSpawnIdx === undefined) {
			// Last-resort deterministic repair for degenerate floors.
			const repairX = spawn.x >= 0 && spawn.x < width ? spawn.x : Math.floor(width / 2);
			const repairY = spawn.y >= 0 && spawn.y < height ? spawn.y : Math.floor(height / 2);
			ground[repairY][repairX] = TILE_TYPE.FLOOR;
			wall[repairY][repairX] = TILE_TYPE.EMPTY;
			blockedMask[repairY][repairX] = false;
			waterMask[repairY][repairX] = false;
			safeSpawnIdx = repairY * width + repairX;
		}
		const safeSpawnX = safeSpawnIdx % width;
		const safeSpawnY = Math.floor(safeSpawnIdx / width);
		if (!isCellWalkable(ground, wall, blockedMask, safeSpawnX, safeSpawnY)) {
			ground[safeSpawnY][safeSpawnX] = TILE_TYPE.FLOOR;
			wall[safeSpawnY][safeSpawnX] = TILE_TYPE.EMPTY;
			blockedMask[safeSpawnY][safeSpawnX] = false;
			waterMask[safeSpawnY][safeSpawnX] = false;
		}

		// Final sanity pass: enforce a single reachable walkable component from spawn.
		const reachability = computeReachability(
			ground,
			wall,
			blockedMask,
			safeSpawnIdx,
			width,
			height,
		);
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				if (!isCellWalkable(ground, wall, blockedMask, x, y)) continue;
				const idx = y * width + x;
				if (!reachability.reachable.has(idx)) blockedMask[y][x] = true;
			}
		}

		const walkableCount = countWalkableCells(ground, wall, blockedMask, width, height);
		if (walkableCount === 0) {
			const fallbackX = safeSpawnIdx % width;
			const fallbackY = Math.floor(safeSpawnIdx / width);
			ground[fallbackY][fallbackX] = TILE_TYPE.FLOOR;
			wall[fallbackY][fallbackX] = TILE_TYPE.EMPTY;
			blockedMask[fallbackY][fallbackX] = false;
			waterMask[fallbackY][fallbackX] = false;
		}

		// Exit: farthest walkable cell from spawn (last floor has no exit)
		const exitIdx =
			i === lastFloorIndex
				? -1
				: findExitIdx(ground, wall, blockedMask, safeSpawnIdx, width, height);

		const rooms = analyzeRooms(rawMap, config, createRng(seed + i + 1000));
		// Tag start / exit rooms for downstream encounter use
		tagSpawnAndExitRooms(rooms, safeSpawnIdx, exitIdx);

		// Apply boss room tag based on floor's bossRules
		if (config.bossRules) {
			const preferredTag = config.bossRules.preferredRoomTag;
			// Pick the largest room with the preferred tag (if any); else largest non-start/exit room
			let bossRoom = rooms
				.filter((r) => r.tag === preferredTag)
				.sort((a, b) => b.area - a.area)[0];
			if (!bossRoom) {
				bossRoom = rooms
					.filter((r) => r.tag !== "start" && r.tag !== "exit")
					.sort((a, b) => b.area - a.area)[0];
			}
			if (bossRoom) bossRoom.tag = "boss";
		}

		result.push({
			ground,
			wall,
			blockedMask,
			waterMask,
			decorationGrid,
			width,
			height,
			spawnIdx: safeSpawnIdx,
			exitIdx,
			rooms,
			vaultPlacements,
		});
	}

	return result;
}

export { TILE_TYPE };
