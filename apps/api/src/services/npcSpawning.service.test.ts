import { describe, expect, it } from "vitest";
import {
	FLOOR_CONFIGS,
	computeWalkableMaskForFloor,
	createInitialState,
	DEFAULT_HERO_INIT,
	regenerateBaseMaps,
} from "@app/shared";
import { encountersById, npcsById, vaults } from "@app/content";
import { spawnNpcsForFloor } from "./npcSpawning.service";

describe("npcSpawning.service", () => {
	it("never stacks NPCs on the same tile when spawning", () => {
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
		const next = spawnNpcsForFloor(state, 0, walkMask, npcsById, encountersById, base);
		const npcs = Object.values(next.floors[0]?.state.actorsById ?? {}).filter(
			(actor) => actor.def.type === "npc" && actor.alive,
		);
		const occupied = new Set(npcs.map((n) => n.idx));
		expect(occupied.size).toBe(npcs.length);
	});

	it("is a no-op when called with an out-of-range floor index", () => {
		const state = createInitialState(1, [FLOOR_CONFIGS[0]], DEFAULT_HERO_INIT);
		const walkMask = new Uint8Array(0);
		const next = spawnNpcsForFloor(state, 99, walkMask, npcsById, encountersById);
		expect(next).toBe(state);
	});
});
