/**
 * Vault injector: stamps handcrafted structures into procedurally generated maps.
 *
 * Vaults are defined in packages/content/src/raw/vaults/*.json and passed in
 * from the API layer — shared never imports @app/content directly.
 *
 * Injection rules:
 * - A vault is eligible if its `tags` overlap with the target room's tag, and
 *   the floor's depth >= vault's minDepth.
 * - The vault must fit within the room's bounding box.
 * - Eligible vaults are sorted by id (alphabetically) before RNG selection
 *   to maintain determinism.
 * - At most one vault is injected per room.
 * - Vault tiles overwrite existing floor/wall tiles in the raw map.
 *
 * The injector does NOT modify blockedMask. Callers (baseLayers.ts) apply vault prop
 * collision after injection using the `collision` flag on each decorationOverride entry.
 */

import { TILE_TYPE } from "../config/map";
import type { Rng } from "../rng";
import type { AnalyzedRoom, FloorConfig, RawMap, VaultDef, VaultPlacement } from "./types";

export function injectVaults(
	rawMap: RawMap,
	rooms: AnalyzedRoom[],
	vaultDefs: readonly VaultDef[],
	config: FloorConfig,
	rng: Rng,
): VaultPlacement[] {
	const placements: VaultPlacement[] = [];
	const { ground, wall } = rawMap;
	const width = ground[0]?.length ?? 0;
	const depth = config.floorDepth;
	const usedRoomIds = new Set<number>();

	// Only consider vaults referenced by this floor's config
	const eligibleVaultIds = new Set(config.vaultIds);
	const candidates = vaultDefs
		.filter((v) => eligibleVaultIds.has(v.id))
		.filter((v) => (v.minDepth ?? 1) <= depth)
		.filter((v) => validateVaultDef(v))
		.sort((a, b) => a.id.localeCompare(b.id, "en"));

	if (candidates.length === 0) return placements;

	// Sort rooms by id for stable iteration order
	const sortedRooms = [...rooms].sort((a, b) => a.id - b.id);

	for (const room of sortedRooms) {
		if (usedRoomIds.has(room.id)) continue;

		// Find eligible vaults for this room's tag
		const matching = candidates.filter((v) => v.tags.includes(room.tag));
		if (matching.length === 0) continue;

		// Pick a vault
		const pick = matching[Math.floor(rng() * matching.length)];

		// Find the room's bounding box
		const bbox = boundingBox(room.cells, width);
		if (!bbox) continue;

		// Check that the vault fits in the room bbox before trying anchors.
		if (pick.width > bbox.w || pick.height > bbox.h) continue;
		const roomCellSet = new Set(room.cells);
		const anchors = buildPlacementCandidates(bbox, pick.width, pick.height);
		let originX = -1;
		let originY = -1;
		for (const [candidateX, candidateY] of anchors) {
			let fits = true;
			for (let vy = 0; vy < pick.height && fits; vy++) {
				const row = pick.layout[vy];
				if (!row) {
					fits = false;
					break;
				}
				for (let vx = 0; vx < pick.width && fits; vx++) {
					const mx = candidateX + vx;
					const my = candidateY + vy;
					const flatIdx = my * width + mx;
					const ch = row[vx];
					if (ch === undefined || !pick.legend[ch]) {
						fits = false;
						break;
					}
					if (mx < 0 || mx >= width || my < 0 || my >= ground.length) {
						fits = false;
						break;
					}
					if (ground[my][mx] === TILE_TYPE.VOID) {
						fits = false;
						break;
					}
					if (!roomCellSet.has(flatIdx)) {
						fits = false;
						break;
					}
				}
			}
			if (fits) {
				originX = candidateX;
				originY = candidateY;
				break;
			}
		}
		if (originX < 0 || originY < 0) continue;

		// Stamp the vault: mutates ground and wall in place
		const markerCells: Record<string, number[]> = {};
		const chestSpawns: Record<string, "regular" | "rare"> = {};
		const groundOverrides: Record<number, number> = {};
		const wallOverrides: Record<number, number> = {};
		const decorationOverrides: Record<number, number> = {};
		const collisionCells = new Set<number>();

		for (let vy = 0; vy < pick.height; vy++) {
			const row = pick.layout[vy];
			if (!row) continue;
			for (let vx = 0; vx < pick.width; vx++) {
				const ch = row[vx];
				if (ch === undefined) continue;
				const entry = pick.legend[ch];
				if (!entry) continue;
				const mx = originX + vx;
				const my = originY + vy;
				const flatIdx = my * width + mx;

				if (entry.tile === "wall" || entry.wallTileId !== undefined) {
					ground[my][mx] = TILE_TYPE.FLOOR;
					wall[my][mx] = TILE_TYPE.WALL;
				} else {
					ground[my][mx] = TILE_TYPE.FLOOR;
					wall[my][mx] = TILE_TYPE.EMPTY;
				}

				if (entry.marker) {
					if (!markerCells[entry.marker]) markerCells[entry.marker] = [];
					markerCells[entry.marker].push(flatIdx);
				}

				if (entry.groundTileId !== undefined) groundOverrides[flatIdx] = entry.groundTileId;
				if (entry.wallTileId !== undefined) wallOverrides[flatIdx] = entry.wallTileId;
				if (entry.decorationTileId !== undefined)
					decorationOverrides[flatIdx] = entry.decorationTileId;
				if (entry.collision) collisionCells.add(flatIdx);
			}
		}

		// Resolve chest spawns from vault spawn entries
		for (const spawn of pick.spawns ?? []) {
			if (spawn.chestType) {
				chestSpawns[spawn.marker] = spawn.chestType;
			}
		}

		placements.push({
			vaultId: pick.id,
			originIdx: originY * width + originX,
			markerCells,
			chestSpawns,
			groundOverrides,
			wallOverrides,
			decorationOverrides,
			collisionCells: [...collisionCells],
		});
		usedRoomIds.add(room.id);
	}

	return placements;
}

interface BBox {
	x: number;
	y: number;
	w: number;
	h: number;
}

function validateVaultDef(vault: VaultDef): boolean {
	if (vault.layout.length !== vault.height) return false;
	for (const row of vault.layout) {
		if (row.length !== vault.width) return false;
		for (const ch of row) {
			if (!vault.legend[ch]) return false;
		}
	}
	return true;
}

function buildPlacementCandidates(
	bbox: BBox,
	vaultWidth: number,
	vaultHeight: number,
): [number, number][] {
	const maxX = bbox.x + bbox.w - vaultWidth;
	const maxY = bbox.y + bbox.h - vaultHeight;
	if (maxX < bbox.x || maxY < bbox.y) return [];

	const centerX = bbox.x + Math.floor((bbox.w - vaultWidth) / 2);
	const centerY = bbox.y + Math.floor((bbox.h - vaultHeight) / 2);
	const out: [number, number][] = [[centerX, centerY]];
	for (let y = bbox.y; y <= maxY; y++) {
		for (let x = bbox.x; x <= maxX; x++) {
			if (x === centerX && y === centerY) continue;
			out.push([x, y]);
		}
	}
	return out;
}

function boundingBox(cells: number[], width: number): BBox | null {
	if (cells.length === 0) return null;
	let minX = Infinity,
		minY = Infinity,
		maxX = -Infinity,
		maxY = -Infinity;
	for (const idx of cells) {
		const x = idx % width;
		const y = Math.floor(idx / width);
		if (x < minX) minX = x;
		if (x > maxX) maxX = x;
		if (y < minY) minY = y;
		if (y > maxY) maxY = y;
	}
	return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}
