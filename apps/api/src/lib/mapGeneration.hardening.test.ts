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
import { encountersById, npcsById, vaults } from "@app/content";
import { spawnNpcsForFloor } from "./spawnNpcsForFloor";

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
		expect(serializeFloors(second)).toBe(serializeFloors(first));
	});

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
});
