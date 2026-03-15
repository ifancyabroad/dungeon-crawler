/**
 * Map generation dispatcher: routes to the appropriate algorithm module.
 * All algorithms are deterministic and accept an injected Rng.
 */

import type { Rng } from "../rng";
import type { FloorConfig, RawMap } from "./types";
import { generateBsp } from "./algorithms/bsp";
import { generateCave } from "./algorithms/cave";
import { generateHybrid } from "./algorithms/hybrid";
import { generateArena } from "./algorithms/arena";

/**
 * Generate a raw map for the given floor config using the configured algorithm.
 * The same rng instance is threaded through; callers must not reuse it across floors.
 */
export function generateMap(config: FloorConfig, rng: Rng): RawMap {
	switch (config.algorithm) {
		case "bsp":
			return generateBsp(config, rng);
		case "cave":
			return generateCave(config, rng);
		case "hybrid":
			return generateHybrid(config, rng);
		case "arena":
			return generateArena(config, rng);
	}
}
