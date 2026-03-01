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
}

interface MapActions {
	setMapConfigOverride: (config: MapGenConfigOverride | null) => void;
	setGameRef: (game: Phaser.Game | null) => void;
	/** Restart Main scene so it rebuilds map from current game store state (e.g. after new game). */
	restartMainScene: () => void;
}

export const useMapStore = create<MapState & MapActions>((set, get) => ({
	mapConfigOverride: null,
	gameRef: null,

	setMapConfigOverride: (config) => set({ mapConfigOverride: config }),
	setGameRef: (game) => set({ gameRef: game }),
	restartMainScene: () => {
		const game = get().gameRef;
		const mainScene = game?.scene?.getScene("Main");
		if (mainScene) mainScene.scene.restart();
	},
}));
