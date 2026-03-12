/**
 * Single source of truth for the Roguelike Remastered tileset (32×32).
 * Tile indices are row-major: index = row * tilesPerRow + col.
 *
 * Tag each tile with theme and role in TILE_METADATA. Use getTileIndicesByThemeAndRole
 * for procedural map rendering and getCollidingIndices for collision.
 */

import type { FloorTheme } from "@app/shared";

export const TILE_WIDTH = 32;
export const TILE_HEIGHT = 32;
export const TILESET_KEY = "roguelike-tileset";

export type TileRole = "floor" | "wall" | "decoration";

export interface TileMetadata {
	theme: FloorTheme;
	role: TileRole;
	type: string;
	collision: boolean;
}

/**
 * Explicit tile metadata: one entry per tileset index.
 * When adding a tile, add { theme, role }. Optional tags can be extended later.
 */
export const TILE_METADATA: Record<number, TileMetadata> = {
	// green forest theme
	109: { theme: "green_forest", role: "wall", type: "tree", collision: true },
	130: { theme: "green_forest", role: "wall", type: "tree", collision: true },
	151: { theme: "green_forest", role: "decoration", type: "grass", collision: false },
	172: { theme: "green_forest", role: "decoration", type: "plant", collision: false },
	193: { theme: "green_forest", role: "decoration", type: "bush", collision: false },
	214: { theme: "green_forest", role: "decoration", type: "rock", collision: true },
	235: { theme: "green_forest", role: "floor", type: "ground", collision: false },
	256: { theme: "green_forest", role: "decoration", type: "path", collision: false },
	298: { theme: "green_forest", role: "floor", type: "water", collision: true },
	// orange forest theme
	110: { theme: "orange_forest", role: "wall", type: "tree", collision: true },
	131: { theme: "orange_forest", role: "wall", type: "tree", collision: true },
	152: { theme: "orange_forest", role: "decoration", type: "grass", collision: false },
	173: { theme: "orange_forest", role: "decoration", type: "plant", collision: false },
	194: { theme: "orange_forest", role: "decoration", type: "bush", collision: false },
	215: { theme: "orange_forest", role: "decoration", type: "rock", collision: true },
	236: { theme: "orange_forest", role: "floor", type: "ground", collision: false },
	257: { theme: "orange_forest", role: "decoration", type: "path", collision: false },
	299: { theme: "orange_forest", role: "floor", type: "water", collision: true },
	// yellow forest theme
	111: { theme: "yellow_forest", role: "wall", type: "tree", collision: true },
	132: { theme: "yellow_forest", role: "wall", type: "tree", collision: true },
	153: { theme: "yellow_forest", role: "decoration", type: "grass", collision: false },
	174: { theme: "yellow_forest", role: "decoration", type: "plant", collision: false },
	195: { theme: "yellow_forest", role: "decoration", type: "bush", collision: false },
	216: { theme: "yellow_forest", role: "decoration", type: "rock", collision: true },
	237: { theme: "yellow_forest", role: "floor", type: "ground", collision: false },
	258: { theme: "yellow_forest", role: "decoration", type: "path", collision: false },
	300: { theme: "yellow_forest", role: "floor", type: "water", collision: true },
	// dark forest theme
	112: { theme: "dark_forest", role: "wall", type: "tree", collision: true },
	133: { theme: "dark_forest", role: "wall", type: "tree", collision: true },
	154: { theme: "dark_forest", role: "decoration", type: "grass", collision: false },
	175: { theme: "dark_forest", role: "decoration", type: "plant", collision: false },
	196: { theme: "dark_forest", role: "decoration", type: "bush", collision: false },
	217: { theme: "dark_forest", role: "decoration", type: "rock", collision: true },
	238: { theme: "dark_forest", role: "floor", type: "ground", collision: false },
	259: { theme: "dark_forest", role: "decoration", type: "path", collision: false },
	301: { theme: "dark_forest", role: "floor", type: "water", collision: true },
};

/**
 * Tile indices that have collision (for Phaser setCollision / display only).
 * Authoritative walkability is in @app/shared: isCellWalkable + blockedMask from buildDecorationLayer.
 * When adding a new decoration type with collision: true, also add it to BLOCKING_DECORATION_TYPES in shared.
 */
export function getCollidingIndices(): number[] {
	return Object.entries(TILE_METADATA)
		.filter(([, meta]) => meta.collision)
		.map(([index]) => Number(index));
}

/** Unique theme names from TILE_METADATA (for UI e.g. theme selector). */
export function getThemes(): FloorTheme[] {
	const themes = new Set<FloorTheme>();
	for (const meta of Object.values(TILE_METADATA)) {
		themes.add(meta.theme);
	}
	return [...themes].sort();
}

/** Tile indices for a given theme and role (e.g. for procedural map rendering). */
export function getTileIndicesByThemeAndRole(theme: FloorTheme, role: TileRole): number[] {
	return Object.entries(TILE_METADATA)
		.filter(([, meta]) => meta.theme === theme && meta.role === role)
		.map(([index]) => Number(index));
}

/** Tile indices for a given theme and type (e.g. decoration type "path", "grass"). */
export function getTileIndicesByThemeAndType(theme: FloorTheme, type: string): number[] {
	return Object.entries(TILE_METADATA)
		.filter(([, meta]) => meta.theme === theme && meta.type === type)
		.map(([index]) => Number(index));
}

/** Decoration types (role === "decoration") grouped by type for a theme. Path is separate for connected placement. */
export function getDecorationsByTheme(theme: FloorTheme): { type: string; indices: number[] }[] {
	const byType = new Map<string, number[]>();
	for (const [index, meta] of Object.entries(TILE_METADATA)) {
		if (meta.theme !== theme || meta.role !== "decoration") continue;
		const list = byType.get(meta.type) ?? [];
		list.push(Number(index));
		byType.set(meta.type, list);
	}
	return [...byType.entries()].map(([type, indices]) => ({ type, indices }));
}

/** Legacy: indices that block movement. Prefer getCollidingIndices(). */
export const COLLIDING_INDICES: number[] = getCollidingIndices();

import { classes, monsters } from "@app/content";

const heroTileMap: Record<string, number> = {};
for (const c of classes) heroTileMap[c.id] = c.tileId;

const monsterTileMap: Record<string, number> = {};
for (const m of monsters) monsterTileMap[m.id] = m.tileId;

/** Entity tile indices keyed by content id, derived from content JSON definitions. */
export const ENTITY_TILES = {
	heroes: heroTileMap,
	monsters: monsterTileMap,
} as const;

export const DEFAULT_HERO_TILE = heroTileMap["warrior"] ?? 742;

/** Resolve tileset index for a hero class. Falls back to warrior tile for unknown ids. */
export function getHeroTile(classId: string): number {
	return heroTileMap[classId] ?? DEFAULT_HERO_TILE;
}

/** Number of tile columns in the tileset spritesheet (used for CSS background-position). */
export const TILESET_COLUMNS = 21;
