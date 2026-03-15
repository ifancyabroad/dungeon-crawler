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
 * The injector does NOT modify blockedMask. Callers (baseLayers.ts) are
 * responsible for applying vault prop collision after injection, using
 * BLOCKING_VAULT_TILE_IDS and the decorationOverrides on each VaultPlacement.
 */

import { TILE_TYPE } from "./config";
import type { Rng } from "../rng";
import type { AnalyzedRoom, FloorConfig, RawMap, VaultDef, VaultPlacement } from "./types";

/**
 * Tile IDs that should block movement when stamped as vault decoration props.
 * Must be kept in sync with tilesetRegistry TILE_METADATA (collision: true, role: "vault_prop").
 */
export const BLOCKING_VAULT_TILE_IDS: ReadonlySet<number> = new Set([412]);

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
		.sort((a, b) => a.id.localeCompare(b.id, "en"));

	if (candidates.length === 0) return placements;

	// Sort rooms by id for stable iteration order
	const sortedRooms = [...rooms].sort((a, b) => a.id - b.id);

	for (const room of sortedRooms) {
		if (usedRoomIds.has(room.id)) continue;

		// Find eligible vaults for this room's tag — sort by id for stable RNG consumption
		const matching = candidates
			.filter((v) => v.tags.includes(room.tag))
			.sort((a, b) => a.id.localeCompare(b.id, "en"));
		if (matching.length === 0) continue;

		// Pick a vault
		const pick = matching[Math.floor(rng() * matching.length)];

		// Find the room's bounding box
		const bbox = boundingBox(room.cells, width);
		if (!bbox) continue;

		// Check that the vault fits; try to center it in the room
		if (pick.width > bbox.w || pick.height > bbox.h) continue;

		const originX = bbox.x + Math.floor((bbox.w - pick.width) / 2);
		const originY = bbox.y + Math.floor((bbox.h - pick.height) / 2);

		// Validate that all vault cells land on valid (non-void) tiles
		let fits = true;
		for (let vy = 0; vy < pick.height && fits; vy++) {
			const row = pick.layout[vy];
			if (!row) {
				fits = false;
				break;
			}
			for (let vx = 0; vx < pick.width && fits; vx++) {
				const mx = originX + vx;
				const my = originY + vy;
				if (mx < 0 || mx >= width || my < 0 || my >= ground.length) {
					fits = false;
					break;
				}
				if (ground[my][mx] === TILE_TYPE.VOID) {
					fits = false;
					break;
				}
			}
		}
		if (!fits) continue;

		// Stamp the vault: mutates ground and wall in place
		const markerCells: Record<string, number[]> = {};
		const decorationOverrides: Record<number, number> = {};
		for (let vy = 0; vy < pick.height; vy++) {
			const row = pick.layout[vy];
			if (!row) continue;
			for (let vx = 0; vx < pick.width; vx++) {
				const ch = row[vx];
				if (ch === undefined) continue;
				const entry = pick.legend[ch];
				if (!entry) {
					console.warn(
						`[vaultInjector] unknown legend char "${ch}" in vault "${pick.id}" — skipping cell`,
					);
					continue;
				}
				const mx = originX + vx;
				const my = originY + vy;
				const flatIdx = my * width + mx;

				if (entry.tile === "wall") {
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

				if (entry.decorationTileId !== undefined) {
					decorationOverrides[flatIdx] = entry.decorationTileId;
				}
			}
		}

		placements.push({
			vaultId: pick.id,
			originIdx: originY * width + originX,
			markerCells,
			decorationOverrides,
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
