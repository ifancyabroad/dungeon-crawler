/**
 * Single source of truth for the Roguelike Remastered tileset (32×32).
 * Tile indices are row-major: index = row * tilesPerRow + col.
 *
 * There are two distinct tile registries:
 *
 * 1. TILE_METADATA — tilemap layer tiles (ground, wall, decoration).
 *    Queried by theme+type to build Phaser tilemaps.
 *
 * 2. ENTITY_TILES — Phaser sprite tiles for world entities (heroes, NPCs, exits).
 *    These are sprites placed on top of the tilemap, not part of any tile layer.
 *    Heroes and NPCs are keyed by content id (theme-independent).
 *    Exits are keyed by floor theme.
 *
 * Collision is authoritative in @app/shared (blockedMask). TILE_METADATA does not
 * drive movement — only rendering and tile lookups by theme/type.
 * Vault tiles placed via decorationTileId/groundTileId/wallTileId in vault JSON
 * do not need to be registered here.
 */

import type { FloorTheme } from "@app/shared";
import { classes, npcs } from "@app/content";

// ---------------------------------------------------------------------------
// Tilemap constants
// ---------------------------------------------------------------------------

export const TILE_WIDTH = 32;
export const TILE_HEIGHT = 32;
export const TILESET_COLUMNS = 21;
export const TILESET_KEY = "roguelike-tileset";

// ---------------------------------------------------------------------------
// Tilemap layer tile registry
// ---------------------------------------------------------------------------

export type TileRole = "floor" | "wall" | "decoration";

export interface TileMetadata {
	theme: FloorTheme;
	role: TileRole;
	/** Logical type within the role, e.g. "ground", "rock". */
	type: string;
}

/**
 * All procedural terrain tiles. One entry per tileset index.
 * When adding a new tile, add it here with the correct theme and role.
 * Vault-specific tiles do not need to be registered here.
 */
export const TILE_METADATA: Record<number, TileMetadata> = {
	// green_forest
	109: { theme: "green_forest", role: "wall", type: "tree" },
	130: { theme: "green_forest", role: "wall", type: "tree" },
	151: { theme: "green_forest", role: "decoration", type: "grass" },
	172: { theme: "green_forest", role: "decoration", type: "plant" },
	193: { theme: "green_forest", role: "decoration", type: "bush" },
	214: { theme: "green_forest", role: "decoration", type: "rock" },
	235: { theme: "green_forest", role: "floor", type: "ground" },
	256: { theme: "green_forest", role: "decoration", type: "path" },
	298: { theme: "green_forest", role: "floor", type: "water" },
	// orange_forest
	110: { theme: "orange_forest", role: "wall", type: "tree" },
	131: { theme: "orange_forest", role: "wall", type: "tree" },
	152: { theme: "orange_forest", role: "decoration", type: "grass" },
	173: { theme: "orange_forest", role: "decoration", type: "plant" },
	194: { theme: "orange_forest", role: "decoration", type: "bush" },
	215: { theme: "orange_forest", role: "decoration", type: "rock" },
	236: { theme: "orange_forest", role: "floor", type: "ground" },
	257: { theme: "orange_forest", role: "decoration", type: "path" },
	299: { theme: "orange_forest", role: "floor", type: "water" },
	// yellow_forest
	111: { theme: "yellow_forest", role: "wall", type: "tree" },
	132: { theme: "yellow_forest", role: "wall", type: "tree" },
	153: { theme: "yellow_forest", role: "decoration", type: "grass" },
	174: { theme: "yellow_forest", role: "decoration", type: "plant" },
	195: { theme: "yellow_forest", role: "decoration", type: "bush" },
	216: { theme: "yellow_forest", role: "decoration", type: "rock" },
	237: { theme: "yellow_forest", role: "floor", type: "ground" },
	258: { theme: "yellow_forest", role: "decoration", type: "path" },
	300: { theme: "yellow_forest", role: "floor", type: "water" },
	// dark_forest
	112: { theme: "dark_forest", role: "wall", type: "tree" },
	133: { theme: "dark_forest", role: "wall", type: "tree" },
	154: { theme: "dark_forest", role: "decoration", type: "grass" },
	175: { theme: "dark_forest", role: "decoration", type: "plant" },
	196: { theme: "dark_forest", role: "decoration", type: "bush" },
	217: { theme: "dark_forest", role: "decoration", type: "rock" },
	238: { theme: "dark_forest", role: "floor", type: "ground" },
	259: { theme: "dark_forest", role: "decoration", type: "path" },
	301: { theme: "dark_forest", role: "floor", type: "water" },
};

/** Tile indices for a given theme and role (e.g. all wall tiles for green_forest). */
export function getTileIndicesByThemeAndRole(theme: FloorTheme, role: TileRole): number[] {
	return Object.entries(TILE_METADATA)
		.filter(([, meta]) => meta.theme === theme && meta.role === role)
		.map(([index]) => Number(index));
}

/** Tile indices for a given theme and logical type (e.g. "grass", "path", "ground"). */
export function getTileIndicesByThemeAndType(theme: FloorTheme, type: string): number[] {
	return Object.entries(TILE_METADATA)
		.filter(([, meta]) => meta.theme === theme && meta.type === type)
		.map(([index]) => Number(index));
}

// ---------------------------------------------------------------------------
// Entity sprite registry (heroes, NPCs, exits)
// ---------------------------------------------------------------------------

/**
 * Sprite tile frame indices for all world entities.
 *
 * - heroes / NPCs: keyed by content id (theme-independent; defined in content JSON).
 * - exits: keyed by floor theme (the staircase tile varies per theme in future; currently
 *   all themes share tile 533).
 *
 * When adding a new entity type, add a key here and a typed accessor below.
 */
export const ENTITY_TILES = {
	heroes: Object.fromEntries(classes.map((c) => [c.id, c.tileId])) as Record<string, number>,
	npcs: Object.fromEntries(npcs.map((n) => [n.id, n.tileId])) as Record<string, number>,
	exits: {
		green_forest: 533,
		orange_forest: 533,
		yellow_forest: 533,
		dark_forest: 533,
	} satisfies Record<FloorTheme, number>,
} as const;

/** Resolve sprite tile for a hero class. Falls back to warrior for unknown ids. */
export function getHeroTile(classId: string): number {
	return ENTITY_TILES.heroes[classId] ?? ENTITY_TILES.heroes["warrior"] ?? 742;
}

/** Resolve sprite tile for a floor exit given the current theme. */
export function getExitTile(theme: FloorTheme): number {
	return ENTITY_TILES.exits[theme];
}
