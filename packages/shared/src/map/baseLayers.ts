/**
 * Regenerate base map layers from seed + floor configs (deterministic).
 *
 * Pipeline per floor:
 *   1. buildShapeMask + algorithm (generate.ts)
 *   2. Room analysis (roomAnalysis.ts)
 *   3. Vault injection (vaultInjector.ts)  ← must be before water/decoration
 *   4. Water mask (buildWaterMask)
 *   5. Scatter decoration (buildDecorationLayer)
 *   6. Apply vault prop collision to blockedMask
 *   7. Spawn / exit point selection
 *
 * Vault injection runs before water and decoration so those stages see the
 * final terrain. Decoration scatter will therefore never land on vault cells,
 * and the water mask respects vault walls.
 *
 * All stages share a single Rng per floor (seed = gameSeed + floorIndex).
 * Vault / encounter defs are passed in from the API layer so @app/shared
 * never imports @app/content.
 */

import { createRng } from "../rng";
import { buildDecorationLayer } from "./decorations";
import { generateMap } from "./generate";
import { buildWaterMask } from "./water";
import { isCellWalkable } from "./walkability";
import { analyzeRooms } from "./roomAnalysis";
import { injectVaults, BLOCKING_VAULT_TILE_IDS } from "./vaultInjector";
import { TILE_TYPE } from "./config";
import type { FloorConfig, RawMap, VaultDef, AnalyzedRoom, VaultPlacement } from "./types";
import { MAP_GEN_VERSION } from "../game/types";

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

/**
 * Find the walkable tile farthest from the spawn point (Euclidean distance).
 * Returns -1 if no walkable tile is found.
 */
export function findExitIdx(
	ground: number[][],
	wall: number[][],
	blockedMask: boolean[][],
	spawnIdx: number,
	width: number,
	height: number,
): number {
	const spawnX = spawnIdx % width;
	const spawnY = Math.floor(spawnIdx / width);
	let bestIdx = -1;
	let bestDist = -1;
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (!isCellWalkable(ground, wall, blockedMask, x, y)) continue;
			const dx = x - spawnX;
			const dy = y - spawnY;
			const dist = dx * dx + dy * dy;
			if (dist > bestDist) {
				bestDist = dist;
				bestIdx = y * width + x;
			}
		}
	}
	return bestIdx;
}

/**
 * Tag the start and exit rooms in the analyzed room list.
 * The room containing spawnIdx is tagged "start"; the one containing exitIdx is tagged "exit".
 * Modifies rooms in place.
 */
function tagSpawnAndExitRooms(
	rooms: AnalyzedRoom[],
	spawnIdx: number,
	exitIdx: number,
	width: number,
): void {
	for (const room of rooms) {
		if (room.cells.includes(spawnIdx)) {
			room.tag = "start";
		} else if (exitIdx >= 0 && room.cells.includes(exitIdx)) {
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
		const rng = createRng(seed + i);

		// Stage 1: algorithm
		const rawMap: RawMap = generateMap(config, rng);
		const { ground, wall, spawn, pathLayer } = rawMap;
		const width = config.width;
		const height = config.height;

		// Stage 2: room analysis
		const rooms = analyzeRooms(rawMap, config, rng);

		// Stage 3: vault injection — must run before water/decoration so those
		// stages see the final terrain (vault walls, vault floor cells).
		let vaultPlacements: VaultPlacement[] = [];
		if (vaultDefs.length > 0 && config.vaultIds.length > 0) {
			vaultPlacements = injectVaults(rawMap, rooms, vaultDefs, config, rng);
		}

		// Stage 4: spawn / exit point selection
		const spawnIdx = spawn.y * width + spawn.x;

		// Stage 5a: water mask — runs on post-vault terrain
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

		// Stage 5b: scatter decoration — runs on post-vault terrain; blockedMask from this
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

		// Stage 6: apply vault prop collision to blockedMask
		for (const placement of vaultPlacements) {
			for (const [flatIdxStr, tileId] of Object.entries(placement.decorationOverrides)) {
				if (BLOCKING_VAULT_TILE_IDS.has(tileId)) {
					const flatIdx = Number(flatIdxStr);
					const x = flatIdx % width;
					const y = Math.floor(flatIdx / width);
					blockedMask[y][x] = true;
				}
			}
		}

		// Exit: farthest walkable cell from spawn (last floor has no exit)
		const exitIdx =
			i === lastFloorIndex
				? -1
				: findExitIdx(ground, wall, blockedMask, spawnIdx, width, height);

		// Tag start / exit rooms for downstream encounter use
		tagSpawnAndExitRooms(rooms, spawnIdx, exitIdx, width);

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
			spawnIdx,
			exitIdx,
			rooms,
			vaultPlacements,
		});
	}

	return result;
}

// Keep TILE_TYPE re-export for convenience
export { TILE_TYPE };
