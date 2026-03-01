import type Phaser from "phaser";
import { create } from "zustand";
import type { MapGenConfig } from "@app/shared";

/** Map config plus client-only decoration options for the sidebar. */
export type MapGenConfigOverride = MapGenConfig & {
	decorationWeights?: Record<string, number>;
	scatterChance?: number;
};

interface MapState {
	/** When set, MainScene uses this instead of URL params. */
	mapConfigOverride: MapGenConfigOverride | null;
	/** Phaser game instance; set by GameCanvas so we can restart Main scene. */
	gameRef: Phaser.Game | null;
	/** When true, sidebar shows map generation controls. */
	debugMode: boolean;
}

interface MapActions {
	setMapConfigOverride: (config: MapGenConfigOverride | null) => void;
	setGameRef: (game: Phaser.Game | null) => void;
	setDebugMode: (on: boolean) => void;
	/** Set override and restart Main scene to apply new map. */
	requestMapRegenerate: (config: MapGenConfigOverride) => void;
}

export const useMapStore = create<MapState & MapActions>((set, get) => ({
	mapConfigOverride: null,
	gameRef: null,
	debugMode: false,

	setMapConfigOverride: (config) => set({ mapConfigOverride: config }),
	setGameRef: (game) => set({ gameRef: game }),
	setDebugMode: (on) => set({ debugMode: on }),
	requestMapRegenerate: (config) => {
		set({ mapConfigOverride: config });
		const game = get().gameRef;
		const mainScene = game?.scene?.getScene("Main");
		if (mainScene) {
			mainScene.scene.restart();
		}
	},
}));
