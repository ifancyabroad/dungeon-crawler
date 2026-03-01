/**
 * Map config resolution: store override, URL params, or defaults.
 * Used by MainScene and mapStore.
 */

import { DEFAULT_MAP_HEIGHT, DEFAULT_MAP_WIDTH } from "@app/shared";
import { DECORATION_WEIGHTS } from "../tiles/tilesetRegistry";
import { useMapStore } from "../../features/map/mapStore";

const DEFAULT_SEED = 12345;
const DEFAULT_THEME = "green_forest";

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

/**
 * Returns the config to use for map generation: store override if set,
 * otherwise URL params (width, height, seed, theme), else defaults.
 */
export function getMapConfig(): MapConfig {
	const override = useMapStore.getState().mapConfigOverride;
	if (override) return override as MapConfig;
	const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
	const width = Math.min(
		80,
		Math.max(
			10,
			parseInt(params.get("width") ?? String(DEFAULT_MAP_WIDTH), 10) || DEFAULT_MAP_WIDTH,
		),
	);
	const height = Math.min(
		80,
		Math.max(
			10,
			parseInt(params.get("height") ?? String(DEFAULT_MAP_HEIGHT), 10) || DEFAULT_MAP_HEIGHT,
		),
	);
	return {
		width,
		height,
		seed: parseInt(params.get("seed") ?? String(DEFAULT_SEED), 10) || DEFAULT_SEED,
		theme: params.get("theme") ?? DEFAULT_THEME,
		algorithm: "cave",
		scatterChance: 0.28,
		decorationWeights: { ...DECORATION_WEIGHTS },
	};
}
