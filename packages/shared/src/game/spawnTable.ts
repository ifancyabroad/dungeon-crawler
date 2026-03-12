import type { FloorTheme } from "../map/themes";

export interface SpawnEntry {
	monsterId: string;
	weight: number;
}

/**
 * Monster spawn pools keyed by FloorTheme.
 * Record<FloorTheme, ...> ensures TypeScript errors if a theme is added without a pool.
 * Weight values are relative — higher weight = more likely to be picked.
 */
const SPAWN_TABLES: Record<FloorTheme, SpawnEntry[]> = {
	green_forest: [{ monsterId: "goblin", weight: 1 }],
	orange_forest: [{ monsterId: "goblin", weight: 1 }],
	yellow_forest: [{ monsterId: "goblin", weight: 1 }],
	dark_forest: [{ monsterId: "goblin", weight: 1 }],
};

/**
 * Returns the spawn pool for a given theme and floor depth.
 * Depth is available for future use (e.g. gating high-tier monsters behind minDepth).
 */
export function getSpawnTable(theme: FloorTheme, _depth: number): SpawnEntry[] {
	return SPAWN_TABLES[theme];
}
