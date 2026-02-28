/**
 * Game state types. JSON-serializable; no platform-specific imports.
 */

import type { MapGenConfig } from "../map/types";

export interface GameState {
	turn: number;
	hero: { x: number; y: number };
	seed: number;
	mapConfig: MapGenConfig;
	/** Canonical walkability: walkable[y][x] === true means the cell can be walked on. */
	walkable: boolean[][];
}
