/**
 * Map config type for client-side map generation (e.g. buildMapAndHero).
 * Used by MainScene and mapStore (setMapConfigOverride).
 */

export type MapConfig = {
	width: number;
	height: number;
	seed: number;
	theme: string;
	algorithm?: "bsp" | "cave";
	caveFloorChance?: number;
	bspRoomInset?: number;
	decorationWeights?: Record<string, number>;
	scatterChance?: number;
};
