/**
 * Regression test: vault marker cells must remain walkable after the full
 * regenerateBaseMaps pipeline, including decoration scatter.
 *
 * buildDecorationLayer has no vault awareness and can place blocking "rock"
 * decorations on any floor cell. Stage 5b in baseLayers.ts clears any such
 * blocks from marker cells. This test verifies that guarantee holds across
 * many seeds for the boss_chamber vault.
 */

import { describe, it, expect } from "vitest";
import { DEFAULT_FLOOR_CONFIG, MAP_GEN_VERSION, regenerateBaseMaps } from "../index";
import type { VaultDef } from "../index";

const BOSS_CHAMBER_VAULT: VaultDef = {
	id: "boss_chamber",
	width: 9,
	height: 9,
	tags: ["chamber"],
	layout: [
		"####.####",
		"#.......#",
		"#.......#",
		"#...B...#",
		".........",
		"#.......#",
		"#.......#",
		"#.......#",
		"####.####",
	],
	legend: {
		"#": { tile: "wall" },
		".": { tile: "floor" },
		B: { tile: "floor", marker: "boss_spawn" },
	},
	spawns: [],
	placementHints: { keepFromSpawn: true },
};

// Hybrid maps produce a large cave body that is reliably tagged "chamber"
// and can accommodate the 9x9 boss_chamber vault.
const VAULT_FLOOR_CONFIG = {
	...DEFAULT_FLOOR_CONFIG,
	width: 60,
	height: 60,
	algorithm: "hybrid" as const,
	algorithmParams: { caveFloorChance: 0.48, roomCount: 6, roomInset: 1 },
	floorDepth: 3,
	vaultIds: ["boss_chamber"],
	bossRules: { npcId: "test_boss", preferredRoomTag: "chamber" as const },
};

describe("vault marker protection", () => {
	it("boss_spawn marker cells are never blocked after decoration scatter", () => {
		const seeds = Array.from({ length: 30 }, (_, i) => i);
		let vaultSeedsFound = 0;

		for (const seed of seeds) {
			const [floor] = regenerateBaseMaps(seed, [VAULT_FLOOR_CONFIG], MAP_GEN_VERSION, {
				vaultDefs: [BOSS_CHAMBER_VAULT],
			});
			if (!floor) continue;

			for (const placement of floor.vaultPlacements) {
				for (const [marker, indices] of Object.entries(placement.markerCells)) {
					for (const flatIdx of indices) {
						const x = flatIdx % floor.width;
						const y = Math.floor(flatIdx / floor.width);
						expect(
							floor.blockedMask[y]![x],
							`seed ${seed}: vault "${placement.vaultId}" marker "${marker}" at (${x},${y}) must not be blocked`,
						).toBe(false);
						vaultSeedsFound++;
					}
				}
			}
		}

		// Sanity check: at least some seeds must have placed the vault,
		// otherwise the test is not actually exercising the protection.
		expect(vaultSeedsFound).toBeGreaterThan(0);
	});
});
