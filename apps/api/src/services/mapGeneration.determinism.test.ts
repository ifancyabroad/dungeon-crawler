import { describe, expect, it } from "vitest";
import {
	FLOOR_CONFIGS,
	MAP_GEN_VERSION,
	regenerateBaseMaps,
	type BaseLayerFloor,
} from "@app/shared";
import { vaults } from "@app/content";

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

describe("map generation determinism", () => {
	it("produces identical base layers for the same seed", () => {
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

	it("produces different base layers for different seeds", () => {
		const floorConfigs = FLOOR_CONFIGS.map((f) => ({ ...f }));
		const a = regenerateBaseMaps(1, floorConfigs, MAP_GEN_VERSION, { vaultDefs: vaults });
		const b = regenerateBaseMaps(2, floorConfigs, MAP_GEN_VERSION, { vaultDefs: vaults });
		expect(serializeFloors(a)).not.toBe(serializeFloors(b));
	});
});
