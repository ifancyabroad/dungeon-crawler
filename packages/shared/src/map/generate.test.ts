import { describe, expect, it } from "vitest";
import {
	createRng,
	DEFAULT_BSP_PARAMS,
	DEFAULT_CAVE_PARAMS,
	DEFAULT_FLOOR_CONFIG,
	generateMap,
	type FloorConfig,
} from "../index";

function makeConfig(
	algorithm: FloorConfig["algorithm"],
	algorithmParams: FloorConfig["algorithmParams"],
): FloorConfig {
	return {
		...DEFAULT_FLOOR_CONFIG,
		width: 25,
		height: 19,
		algorithm,
		algorithmParams,
	};
}

describe("generateMap", () => {
	it("produces expected map dimensions for all supported algorithms", () => {
		const configs: FloorConfig[] = [
			makeConfig("bsp", DEFAULT_BSP_PARAMS),
			makeConfig("cave", DEFAULT_CAVE_PARAMS),
			makeConfig("hybrid", { caveFloorChance: 0.45, roomCount: 6, roomInset: 1 }),
			makeConfig("arena", { arenaRadiusFraction: 0.55 }),
		];

		for (const config of configs) {
			const map = generateMap(config, createRng(12345));
			expect(map.ground).toHaveLength(config.height);
			expect(map.wall).toHaveLength(config.height);
			expect(map.pathLayer).toHaveLength(config.height);
			expect(map.shapeMask).toHaveLength(config.height);
			expect(map.ground[0]).toHaveLength(config.width);
			expect(map.wall[0]).toHaveLength(config.width);
			expect(map.pathLayer[0]).toHaveLength(config.width);
			expect(map.shapeMask[0]).toHaveLength(config.width);
		}
	});

	it("is deterministic for the same config + seed", () => {
		const config = makeConfig("hybrid", {
			caveFloorChance: 0.45,
			roomCount: 6,
			roomInset: 1,
		});
		const first = generateMap(config, createRng(777));
		const second = generateMap(config, createRng(777));
		expect(second).toEqual(first);
	});
});
