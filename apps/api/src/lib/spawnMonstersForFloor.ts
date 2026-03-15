import {
	computeWalkableMaskForFloor,
	createRng,
	getActorAtIdx,
	regenerateBaseMaps,
	spawnMonster,
	type GameState,
	type MonsterInit,
} from "@app/shared";
import { vaults, type EncounterDefinition, type MonsterDefinition } from "@app/content";

/**
 * Spawn monsters on a floor using the encounter-based system.
 *
 * - Each floor config has an `encounterTable` (weighted encounter IDs) and `enemyDensity`.
 * - Number of encounter groups = ceil(enemyDensity × walkable-area / 25), clamped to [2, 20].
 * - Encounter groups are placed in rooms that are not the spawn/exit room when rooms are known.
 * - RNG seed = state.seed + floorIndex + 1 (offset by 1 to avoid collision with map gen RNG).
 *
 * Falls back to a minimal spawn if encounterTable is empty (e.g. first floor before full config).
 */
export function spawnMonstersForFloor(
	state: GameState,
	floorIndex: number,
	walkMask: Uint8Array,
	monstersById: Record<string, MonsterDefinition>,
	encountersById: Record<string, EncounterDefinition>,
): GameState {
	const floor = state.floors[floorIndex];
	if (!floor) return state;

	const config = floor.config;
	const floorSize = config.width * config.height;
	const rng = createRng(state.seed + floorIndex + 1);

	// Collect eligible encounter entries for this depth
	const depth = config.floorDepth;
	const eligible = config.encounterTable.filter(
		(e) =>
			(e.minDepth === undefined || e.minDepth <= depth) &&
			(e.maxDepth === undefined || e.maxDepth >= depth),
	);

	if (eligible.length === 0) return state;

	const totalWeight = eligible.reduce((s, e) => s + e.weight, 0);

	// Determine number of encounter groups from enemyDensity
	const walkableCount = walkMask.reduce((n, v) => n + v, 0);
	const groupCount = Math.max(
		2,
		Math.min(20, Math.ceil((config.enemyDensity * walkableCount) / 25)),
	);

	let current = state;

	for (let g = 0; g < groupCount; g++) {
		// Weighted pick of encounter
		let roll = rng() * totalWeight;
		let tableEntry = eligible[eligible.length - 1];
		for (const e of eligible) {
			roll -= e.weight;
			if (roll <= 0) {
				tableEntry = e;
				break;
			}
		}

		const encounterDef = encountersById[tableEntry.encounterId];
		if (!encounterDef) continue;

		// Weighted pick of entry within the encounter
		const entryTotal = encounterDef.entries.reduce((s, e) => s + e.weight, 0);
		let entryRoll = rng() * entryTotal;
		let chosenEntry = encounterDef.entries[encounterDef.entries.length - 1];
		for (const e of encounterDef.entries) {
			entryRoll -= e.weight;
			if (entryRoll <= 0) {
				chosenEntry = e;
				break;
			}
		}

		const def = monstersById[chosenEntry.monsterId];
		if (!def) continue;

		// Spawn `count` monsters near a random walkable cell
		for (let n = 0; n < chosenEntry.count; n++) {
			const startOffset = Math.floor(rng() * floorSize);
			let spawnIdx: number | undefined;
			for (let j = 0; j < floorSize; j++) {
				const idx = (startOffset + j) % floorSize;
				// Don't spawn on spawn point or exit
				if (idx === floor.state.spawnIdx) continue;
				if (floor.state.exitIdx !== null && idx === floor.state.exitIdx) continue;
				if (walkMask[idx] === 1 && !getActorAtIdx(current.floors[floorIndex].state, idx)) {
					spawnIdx = idx;
					break;
				}
			}
			if (spawnIdx === undefined) break;

			const init: MonsterInit = {
				monsterId: def.id,
				name: def.name,
				hp: def.hp,
				maxHp: def.hp,
				armorClass: def.armorClass,
				attributes: { ...def.baseAttributes },
				xpReward: def.xpReward,
				aiStrategy: def.aiStrategy,
			};
			current = spawnMonster(current, floorIndex, init, spawnIdx);
		}
	}

	return current;
}

/**
 * Handle side effects when the hero descends to a new floor: spawn monsters lazily on first visit.
 * No-ops if the floor already has monsters.
 */
export function applyDescendSideEffects(
	state: GameState,
	toFloor: number,
	monstersById: Record<string, MonsterDefinition>,
	encountersById: Record<string, EncounterDefinition>,
	walkMask?: Uint8Array,
): GameState {
	const floor = state.floors[toFloor];
	if (!floor) return state;

	const hasMonsters = Object.values(floor.state.actorsById).some((a) => a.def.type === "monster");
	if (hasMonsters) return state;

	if (!walkMask) {
		const baseLayers = regenerateBaseMaps(
			state.seed,
			state.floors.map((f) => f.config),
			state.mapGenVersion,
			{ vaultDefs: vaults },
		);
		const base = baseLayers[toFloor];
		if (!base) return state;
		walkMask = computeWalkableMaskForFloor(base, floor.state.tileOverrides);
	}

	return spawnMonstersForFloor(state, toFloor, walkMask, monstersById, encountersById);
}
