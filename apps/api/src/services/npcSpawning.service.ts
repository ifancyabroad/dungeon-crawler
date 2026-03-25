import {
	applyPassiveSkill,
	computeWalkableMaskForFloor,
	createRng,
	getActorAtIdx,
	regenerateBaseMaps,
	spawnNpc,
	type BaseLayerFloor,
	type GameState,
	type NpcInit,
} from "@app/shared";
import { vaults, skillsById, type EncounterDefinition, type NpcDefinition } from "@app/content";
import type { PassiveSkillDefinition } from "@app/shared";

const MIN_RANDOM_SPAWN_DISTANCE = 4;

function npcInitFromDef(def: NpcDefinition): NpcInit {
	return {
		npcId: def.id,
		name: def.name,
		faction: def.faction,
		role: def.role,
		hp: def.hp,
		maxHp: def.hp,
		armorClass: def.armorClass,
		attributes: { ...def.baseAttributes },
		damageResistances: def.damageResistances,
		damageImmunities: def.damageImmunities,
		damageVulnerabilities: def.damageVulnerabilities,
		xpReward: def.xpReward,
		challengeRating: def.challengeRating,
		savingThrowProficiencies: def.savingThrowProficiencies,
		combatStrategy: def.combatStrategy,
		idleStrategy: def.idleStrategy,
		activeSkills: def.activeSkills,
		passiveSkills: def.passiveSkills,
	};
}

/**
 * Spawn an NPC and immediately apply any passive skills to the resulting actor.
 * Returns the updated game state.
 */
function spawnNpcWithPassives(
	state: GameState,
	floorIndex: number,
	init: NpcInit,
	idx: number,
): GameState {
	const next = spawnNpc(state, floorIndex, init, idx);

	if (init.passiveSkills.length === 0) return next;

	const floor = next.floors[floorIndex];
	if (!floor) return next;

	// Find the actor that was just spawned — it has the highest counter suffix for this npcId.
	// More reliably, find it by position since we just placed it at `idx`.
	const spawnedActor = Object.values(floor.state.actorsById).find(
		(a) => a.def.type === "npc" && a.def.npcId === init.npcId && a.idx === idx,
	);
	if (!spawnedActor) return next;

	let actor = spawnedActor;
	for (const skill of init.passiveSkills) {
		const skillDef = skillsById[skill.id];
		if (skillDef?.skillType === "passive") {
			actor = applyPassiveSkill(actor, skillDef as PassiveSkillDefinition, 0, skill.rank);
		}
	}

	const newActorsById = { ...floor.state.actorsById, [actor.id]: actor };
	const newFloors = next.floors.slice();
	newFloors[floorIndex] = {
		...floor,
		state: { ...floor.state, actorsById: newActorsById },
	};
	return { ...next, floors: newFloors };
}

/**
 * Spawn all NPCs for a floor in one pass:
 *   1. Random encounter groups from the floor's encounterTable (density-scaled).
 *   2. Vault-specific encounters pinned to their marker cells (from vaultPlacements in `base`).
 *
 * RNG seed = state.seed + floorIndex + 1 (offset by 1 to avoid collision with map gen RNG).
 */
export function spawnNpcsForFloor(
	state: GameState,
	floorIndex: number,
	walkMask: Uint8Array,
	npcsById: Record<string, NpcDefinition>,
	encountersById: Record<string, EncounterDefinition>,
	base?: BaseLayerFloor,
): GameState {
	const floor = state.floors[floorIndex];
	if (!floor) return state;

	const config = floor.config;
	const floorSize = config.width * config.height;
	const rng = createRng(state.seed + floorIndex + 1);

	let current = state;

	// --- Part 1: random encounter groups ---
	const depth = config.floorDepth;
	const eligible = config.encounterTable.filter(
		(e) =>
			(e.minDepth === undefined || e.minDepth <= depth) &&
			(e.maxDepth === undefined || e.maxDepth >= depth),
	);

	if (eligible.length > 0) {
		const totalWeight = eligible.reduce((s, e) => s + e.weight, 0);
		const walkableCount = walkMask.reduce((n, v) => n + v, 0);
		const groupCount = Math.max(
			2,
			Math.min(20, Math.ceil((config.enemyDensity * walkableCount) / 25)),
		);

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

			const def = npcsById[chosenEntry.npcId];
			if (!def) continue;

			for (let n = 0; n < chosenEntry.count; n++) {
				const spawnIdx =
					findRandomSpawnIdx(
						current,
						floorIndex,
						floorSize,
						walkMask,
						rng,
						MIN_RANDOM_SPAWN_DISTANCE,
					) ?? findRandomSpawnIdx(current, floorIndex, floorSize, walkMask, rng, 0);
				if (spawnIdx === undefined) break;
				current = spawnNpcWithPassives(current, floorIndex, npcInitFromDef(def), spawnIdx);
			}
		}
	}

	// --- Part 2: vault-pinned encounters ---
	if (base) {
		const { width, height } = base;
		for (const placement of base.vaultPlacements) {
			const vaultDef = vaults.find((v) => v.id === placement.vaultId);
			if (!vaultDef?.spawns) continue;

			for (const vaultSpawn of vaultDef.spawns) {
				const markerIndices = placement.markerCells[vaultSpawn.marker];
				if (!markerIndices?.length) continue;

				const encounterDef = encountersById[vaultSpawn.encounterId];
				if (!encounterDef) continue;

				for (const markerIdx of markerIndices) {
					for (const entry of encounterDef.entries) {
						const def = npcsById[entry.npcId];
						if (!def) continue;
						for (let count = 0; count < entry.count; count++) {
							const spawnIdx = resolveSpawnNear(
								markerIdx,
								width,
								height,
								walkMask,
								current.floors[floorIndex].state,
								floor.state.spawnIdx,
								1,
							);
							if (spawnIdx === undefined) break;
							current = spawnNpcWithPassives(
								current,
								floorIndex,
								npcInitFromDef(def),
								spawnIdx,
							);
						}
					}
				}
			}
		}
	}

	return current;
}

/**
 * Returns the marker index if it is walkable and unoccupied, otherwise searches
 * outward in rings for the nearest walkable unoccupied cell.
 */
function resolveSpawnNear(
	markerIdx: number,
	width: number,
	height: number,
	walkMask: Uint8Array,
	floorState: { actorsById: Record<string, { idx: number }> },
	heroSpawnIdx: number,
	minDistanceFromHero: number,
): number | undefined {
	const occupied = new Set(Object.values(floorState.actorsById).map((a) => a.idx));
	if (
		walkMask[markerIdx] === 1 &&
		!occupied.has(markerIdx) &&
		manhattanDistance(markerIdx, heroSpawnIdx, width) >= minDistanceFromHero
	) {
		return markerIdx;
	}

	const markerX = markerIdx % width;
	const markerY = Math.floor(markerIdx / width);

	for (let radius = 1; radius <= 3; radius++) {
		for (let dy = -radius; dy <= radius; dy++) {
			for (let dx = -radius; dx <= radius; dx++) {
				if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
				const x = markerX + dx;
				const y = markerY + dy;
				if (x < 0 || x >= width || y < 0 || y >= height) continue;
				const idx = y * width + x;
				if (walkMask[idx] !== 1 || occupied.has(idx)) continue;
				if (manhattanDistance(idx, heroSpawnIdx, width) < minDistanceFromHero) continue;
				return idx;
			}
		}
	}
	return undefined;
}

function findRandomSpawnIdx(
	state: GameState,
	floorIndex: number,
	floorSize: number,
	walkMask: Uint8Array,
	rng: () => number,
	minDistanceFromHero: number,
): number | undefined {
	const floor = state.floors[floorIndex];
	if (!floor) return undefined;
	const startOffset = Math.floor(rng() * floorSize);
	for (let j = 0; j < floorSize; j++) {
		const idx = (startOffset + j) % floorSize;
		if (idx === floor.state.spawnIdx) continue;
		if (floor.state.exitIdx !== null && idx === floor.state.exitIdx) continue;
		if (walkMask[idx] !== 1) continue;
		if (getActorAtIdx(floor.state, idx)) continue;
		if (
			manhattanDistance(idx, floor.state.spawnIdx, floor.config.width) < minDistanceFromHero
		) {
			continue;
		}
		return idx;
	}
	return undefined;
}

function manhattanDistance(a: number, b: number, width: number): number {
	const ax = a % width;
	const ay = Math.floor(a / width);
	const bx = b % width;
	const by = Math.floor(b / width);
	return Math.abs(ax - bx) + Math.abs(ay - by);
}

/**
 * Spawn NPCs on a new floor on first visit (no-op if already populated).
 * Uses cached base layers and walk mask when available to avoid recomputation.
 */
export function applyDescendSideEffects(
	state: GameState,
	toFloor: number,
	npcsById: Record<string, NpcDefinition>,
	encountersById: Record<string, EncounterDefinition>,
	walkMask?: Uint8Array,
	base?: BaseLayerFloor,
): GameState {
	const floor = state.floors[toFloor];
	if (!floor) return state;

	const hasNpcs = Object.values(floor.state.actorsById).some((a) => a.def.type === "npc");
	if (hasNpcs) return state;

	if (!walkMask || !base) {
		const baseLayers = regenerateBaseMaps(
			state.seed,
			state.floors.map((f) => f.config),
			state.mapGenVersion,
			{ vaultDefs: vaults },
		);
		base = baseLayers[toFloor];
		if (!base) return state;
		walkMask = computeWalkableMaskForFloor(base, floor.state.tileOverrides);
	}

	return spawnNpcsForFloor(state, toFloor, walkMask, npcsById, encountersById, base);
}
