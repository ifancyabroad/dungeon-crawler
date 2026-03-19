import { describe, expect, it } from "vitest";
import {
	FLOOR_CONFIGS,
	MAP_GEN_VERSION,
	computeWalkableMaskForFloor,
	createInitialState,
	DEFAULT_HERO_INIT,
	regenerateBaseMaps,
	type BaseLayerFloor,
} from "@app/shared";
import { encountersById, monstersById, vaults } from "@app/content";
import { spawnMonstersForFloor } from "../lib/spawnMonstersForFloor";

function serializeFloors(floors: BaseLayerFloor[]): string {
	return JSON.stringify(
		floors.map((f) => ({
			spawnIdx: f.spawnIdx,
			exitIdx: f.exitIdx,
			ground: f.ground,
			wall: f.wall,
			blockedMask: f.blockedMask,
			waterMask: f.waterMask,
			vaultPlacements: f.vaultPlacements,
		})),
	);
}

function reachableFromSpawn(
	walkMask: Uint8Array,
	width: number,
	height: number,
	spawnIdx: number,
): Set<number> {
	const reachable = new Set<number>();
	if (walkMask[spawnIdx] !== 1) return reachable;
	const queue: number[] = [spawnIdx];
	reachable.add(spawnIdx);
	for (let head = 0; head < queue.length; head++) {
		const idx = queue[head];
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
			if (walkMask[nIdx] !== 1 || reachable.has(nIdx)) continue;
			reachable.add(nIdx);
			queue.push(nIdx);
		}
	}
	return reachable;
}

describe("map generation hardening", () => {
	it("produces deterministic base layers for the same seed", () => {
		const seed = 1337;
		const floorConfigs = FLOOR_CONFIGS.map((f) => ({ ...f }));
		const first = regenerateBaseMaps(seed, floorConfigs, MAP_GEN_VERSION, {
			vaultDefs: vaults,
		});
		const second = regenerateBaseMaps(seed, floorConfigs, MAP_GEN_VERSION, {
			vaultDefs: vaults,
		});
		const third = regenerateBaseMaps(seed, floorConfigs, MAP_GEN_VERSION, {
			vaultDefs: vaults,
		});

		const firstHash = serializeFloors(first);
		expect(serializeFloors(second)).toBe(firstHash);
		expect(serializeFloors(third)).toBe(firstHash);
	});

	it("keeps all walkable cells connected to spawn across seed sweep", () => {
		for (let seed = 1; seed <= 20; seed++) {
			const bases = regenerateBaseMaps(seed, FLOOR_CONFIGS, MAP_GEN_VERSION, {
				vaultDefs: vaults,
			});
			for (const base of bases) {
				const walkMask = computeWalkableMaskForFloor(base, {});
				const walkableCount = walkMask.reduce((n, v) => n + v, 0);
				expect(walkableCount).toBeGreaterThan(0);
				expect(walkMask[base.spawnIdx]).toBe(1);

				const reachable = reachableFromSpawn(
					walkMask,
					base.width,
					base.height,
					base.spawnIdx,
				);
				expect(reachable.size).toBe(walkableCount);
				if (base.exitIdx >= 0) {
					expect(walkMask[base.exitIdx]).toBe(1);
					expect(reachable.has(base.exitIdx)).toBe(true);
				}
			}
		}
	}, 20000);

	it("never stacks monsters on the same tile when spawning", () => {
		const state = createInitialState(777, [FLOOR_CONFIGS[2]], DEFAULT_HERO_INIT);
		const [base] = regenerateBaseMaps(
			state.seed,
			state.floors.map((f) => f.config),
			state.mapGenVersion,
			{ vaultDefs: vaults },
		);
		expect(base).toBeDefined();
		if (!base) return;

		const walkMask = computeWalkableMaskForFloor(
			base,
			state.floors[0]?.state.tileOverrides ?? {},
		);
		const next = spawnMonstersForFloor(state, 0, walkMask, monstersById, encountersById, base);
		const monsters = Object.values(next.floors[0]?.state.actorsById ?? {}).filter(
			(actor) => actor.def.type === "monster" && actor.alive,
		);
		const occupied = new Set(monsters.map((m) => m.idx));
		expect(occupied.size).toBe(monsters.length);
		for (const monster of monsters) {
			expect(monster.idx).not.toBe(next.floors[0]?.state.spawnIdx);
		}
	});
});
