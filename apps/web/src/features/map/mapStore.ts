import type { FloorConfig } from "@app/shared";
import type Phaser from "phaser";
import { create } from "zustand";

type FloorConfigWithSeed = FloorConfig & { seed: number };

interface MapState {
	/** When set, MainScene uses this instead of state-derived config. */
	mapConfigOverride: FloorConfigWithSeed | null;
	/** Phaser game instance; set by GameCanvas so we can restart Main scene. */
	gameRef: Phaser.Game | null;
	/**
	 * Precomputed opacity mask for the current floor (1 = opaque/wall).
	 * Set by MainScene after each floor is built; used by SkillHotbar to
	 * restrict targeting to tiles within the hero's line of sight.
	 */
	opacityMask: Uint8Array | null;
}

interface MapActions {
	setMapConfigOverride: (config: FloorConfigWithSeed | null) => void;
	setGameRef: (game: Phaser.Game | null) => void;
	setOpacityMask: (mask: Uint8Array) => void;
	/** Restart Main scene so it rebuilds map from current game store state (e.g. after new game). */
	restartMainScene: () => void;
}

export const useMapStore = create<MapState & MapActions>((set, get) => ({
	mapConfigOverride: null,
	gameRef: null,
	opacityMask: null,

	setMapConfigOverride: (config) => set({ mapConfigOverride: config }),
	setGameRef: (game) => set({ gameRef: game }),
	setOpacityMask: (mask) => set({ opacityMask: mask }),
	restartMainScene: () => {
		const game = get().gameRef;
		const mainScene = game?.scene?.getScene("Main");
		if (mainScene) mainScene.scene.restart();
	},
}));
