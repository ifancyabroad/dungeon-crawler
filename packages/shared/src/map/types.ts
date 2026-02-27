/**
 * Map constants and logical tile types.
 * Client maps TILE_TYPE to tileset indices; shared stays platform-agnostic.
 */

/** Logical tile types for map generation. Client maps these to tileset indices. */
export const TILE_TYPE = {
	FLOOR: 0,
	WALL: 1,
	/** No tile (e.g. empty cell on wall layer) */
	EMPTY: -1,
	/** No ground (empty space; walls still border so player cannot leave bounds) */
	VOID: -2,
} as const;

export const DEFAULT_MAP_WIDTH = 50;
export const DEFAULT_MAP_HEIGHT = 50;

/** Map generation algorithm: BSP (room-corridor) or cave (cellular automata, organic). */
export type MapGenAlgorithm = "bsp" | "cave";

/** Configuration for procedural map generation. Theme is for client tile mapping; shared only uses dimensions. */
export interface MapGenConfig {
	seed: number;
	width: number;
	height: number;
	theme: string;
	/** Default "bsp". "cave" produces organic, cavern-like layouts with large open spaces. */
	algorithm?: MapGenAlgorithm;
	/** Cave only: initial floor chance for cellular automata (0.35–0.55). Lower = more walls/trees. Default 0.45. */
	caveFloorChance?: number;
	/** BSP only: room inset from leaf bounds (1–3). Higher = thicker walls between rooms, smaller rooms. Default 1. */
	bspRoomInset?: number;
}

/** Result of generateMap: layers (logical tile types), spawn, and path mask for connected path decoration. */
export interface GeneratedMap {
	ground: number[][];
	wall: number[][];
	spawn: { x: number; y: number };
	/** Same size as ground; 1 = path cell (e.g. corridor), 0 = no path. Client uses for connected path decoration. */
	pathLayer: number[][];
}
