import {
	computeWalkableMaskForFloor,
	createRng,
	type BaseLayerFloor,
	type ChestState,
	type ChestType,
	type GameState,
} from "@app/shared";
import { vaults } from "@app/content";

const MIN_CHEST_DISTANCE = 15;
const MAX_CHESTS_PER_FLOOR = 2;

function manhattanDistance(a: number, b: number, width: number): number {
	const ax = a % width;
	const ay = Math.floor(a / width);
	const bx = b % width;
	const by = Math.floor(b / width);
	return Math.abs(ax - bx) + Math.abs(ay - by);
}

/**
 * Place chests on a floor at game creation or first visit.
 * Random chests avoid the spawn area and vault footprints.
 * Vault chest spawns (chestSpawns entries in VaultPlacement) are placed exactly at their markers.
 *
 * Uses a deterministic sub-RNG keyed to seed + floorIndex so chest placement never
 * consumes from the main game RNG and remains stable across replays.
 */
export function placeChestsForFloor(
	state: GameState,
	floorIndex: number,
	base: BaseLayerFloor,
): GameState {
	const floor = state.floors[floorIndex];
	if (!floor) return state;

	const { width, height } = base;
	const floorSize = width * height;
	const floorDepth = floor.config.floorDepth;
	const rng = createRng(state.seed + floorIndex + 2000);

	const newChestsByIdx: Record<string, ChestState> = { ...floor.state.chestsByIdx };

	// --- Vault chest spawns ---
	for (const placement of base.vaultPlacements) {
		for (const [marker, chestType] of Object.entries(placement.chestSpawns)) {
			const indices = placement.markerCells[marker];
			if (!indices?.length) continue;
			for (const idx of indices) {
				newChestsByIdx[String(idx)] = { rarity: chestType, opened: false };
			}
		}
	}

	// --- Random chests ---
	// Build the set of vault-occupied cells to avoid.
	const vaultCells = new Set<number>();
	for (const placement of base.vaultPlacements) {
		const vaultDef = vaults.find((v) => v.id === placement.vaultId);
		if (!vaultDef) continue;
		const ox = placement.originIdx % width;
		const oy = Math.floor(placement.originIdx / width);
		for (let vy = 0; vy < vaultDef.height; vy++) {
			for (let vx = 0; vx < vaultDef.width; vx++) {
				vaultCells.add((oy + vy) * width + (ox + vx));
			}
		}
	}

	const spawnIdx = floor.state.spawnIdx;
	const exitIdx = floor.state.exitIdx;
	const walkMask = computeWalkableMaskForFloor(base, floor.state.tileOverrides);

	// Collect candidate indices: walkable, far from spawn, not exit, not vault.
	const candidates: number[] = [];
	for (let idx = 0; idx < floorSize; idx++) {
		if (walkMask[idx] !== 1) continue;
		if (idx === spawnIdx) continue;
		if (exitIdx !== null && idx === exitIdx) continue;
		if (vaultCells.has(idx)) continue;
		if (manhattanDistance(idx, spawnIdx, width) < MIN_CHEST_DISTANCE) continue;
		candidates.push(idx);
	}

	if (candidates.length === 0) return state;

	const count = 1 + Math.floor(rng() * MAX_CHESTS_PER_FLOOR);
	const used = new Set<number>();
	for (let i = 0; i < count && candidates.length > used.size; i++) {
		let pick: number;
		do {
			pick = candidates[Math.floor(rng() * candidates.length)]!;
		} while (used.has(pick));
		used.add(pick);

		const rareChance = Math.min(0.1 * floorDepth, 0.5);
		const chestType: ChestType = rng() < rareChance ? "rare" : "regular";
		newChestsByIdx[String(pick)] = { rarity: chestType, opened: false };
	}

	const newFloors = state.floors.slice();
	newFloors[floorIndex] = {
		...floor,
		state: { ...floor.state, chestsByIdx: newChestsByIdx },
	};
	return { ...state, floors: newFloors };
}
