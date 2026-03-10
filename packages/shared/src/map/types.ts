/**
 * Map types. Constants and default config live in config.ts.
 */

/** Map generation algorithm: BSP (room-corridor) or cave (cellular automata, organic). */
export type MapGenAlgorithm = "bsp" | "cave";

/** Configuration for procedural map generation. All fields required so callers don't need fallbacks. Theme is for client tile mapping; shared only uses dimensions. */
export interface MapGenConfig {
	seed: number;
	width: number;
	height: number;
	theme: string;
	/** "bsp" (rooms + corridors) or "cave" (cellular automata). */
	algorithm: MapGenAlgorithm;
	/** Cave only: initial floor chance for cellular automata (0.35–0.55). */
	caveFloorChance: number;
	/** BSP only: room inset from leaf bounds (1–3). */
	bspRoomInset: number;
	/** Weights per decoration type for buildDecorationLayer (e.g. grass, plant, bush, rock). */
	decorationWeights: Record<string, number>;
	/** Scatter chance for non-path decorations (0–1). */
	scatterChance: number;
	/** Target fraction of cells that are void (0–0.5). Higher = more irregular. */
	shapeVoidTarget: number;
}

/** Result of generateMap: layers (logical tile types), spawn, and path mask for connected path decoration. */
export interface GeneratedMap {
	ground: number[][];
	wall: number[][];
	spawn: { x: number; y: number };
	/** Same size as ground; 1 = path cell (e.g. corridor), 0 = no path. Client uses for connected path decoration. */
	pathLayer: number[][];
}
