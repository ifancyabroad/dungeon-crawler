import {
	BASE_MONSTERS_PER_FLOOR,
	createRng,
	getActorAtIdx,
	getSpawnTable,
	spawnMonster,
	type GameState,
	type MonsterInit,
} from "@app/shared";
import type { MonsterDefinition } from "@app/content";

/**
 * Spawn monsters on a floor using a seeded RNG.
 *
 * - Theme determines the monster pool (see spawnTable.ts in @app/shared).
 * - Count = BASE_MONSTERS_PER_FLOOR + floorIndex (one extra per deeper floor).
 * - RNG seed = state.seed + floorIndex + 1 (offset by 1 to avoid colliding with map gen).
 * - Each monster gets a random walkable, unoccupied tile via the seeded RNG.
 */
export function spawnMonstersForFloor(
	state: GameState,
	floorIndex: number,
	walkMask: Uint8Array,
	monstersById: Record<string, MonsterDefinition>,
): GameState {
	const floor = state.floors[floorIndex];
	if (!floor) return state;

	const theme = floor.config.theme;
	const depth = floorIndex;
	const count = BASE_MONSTERS_PER_FLOOR + depth;
	const floorSize = floor.config.width * floor.config.height;

	const pool = getSpawnTable(theme, depth);
	if (pool.length === 0) return state;

	const totalWeight = pool.reduce((sum, e) => sum + e.weight, 0);
	const rng = createRng(state.seed + floorIndex + 1);

	let current = state;
	for (let i = 0; i < count; i++) {
		// Weighted random pick from pool
		let roll = rng() * totalWeight;
		let entry = pool[pool.length - 1];
		for (const e of pool) {
			roll -= e.weight;
			if (roll <= 0) {
				entry = e;
				break;
			}
		}

		const def = monstersById[entry.monsterId];
		if (!def) continue;

		// Pick a random walkable, unoccupied tile
		const startOffset = Math.floor(rng() * floorSize);
		let spawnIdx: number | undefined;
		for (let j = 0; j < floorSize; j++) {
			const idx = (startOffset + j) % floorSize;
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
		};

		current = spawnMonster(current, floorIndex, init, spawnIdx);
	}

	return current;
}
