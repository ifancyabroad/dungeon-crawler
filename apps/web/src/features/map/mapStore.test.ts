import type Phaser from "phaser";
import { DEFAULT_FLOOR_CONFIG } from "@app/shared";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useMapStore } from "./mapStore";

describe("mapStore", () => {
	beforeEach(() => {
		useMapStore.setState({
			mapConfigOverride: null,
			gameRef: null,
		});
	});

	it("sets map config override for scene rebuilds", () => {
		const config = { ...DEFAULT_FLOOR_CONFIG, width: 20, height: 20, seed: 1 };
		useMapStore.getState().setMapConfigOverride(config);
		expect(useMapStore.getState().mapConfigOverride).toEqual(config);
	});

	it("stores opacity mask used by targeting logic", () => {
		const mask = Uint8Array.from([0, 1, 0, 1]);
		useMapStore.getState().setOpacityMask(mask);
		expect(useMapStore.getState().opacityMask).toEqual(mask);
	});

	it("restartMainScene restarts Main scene when available", () => {
		const restart = vi.fn();
		const mockMainScene = { scene: { restart } };
		const mockGame = {
			scene: {
				getScene: vi.fn().mockReturnValue(mockMainScene),
			},
		};

		useMapStore.getState().setGameRef(mockGame as unknown as Phaser.Game);
		useMapStore.getState().restartMainScene();

		expect(mockGame.scene.getScene).toHaveBeenCalledWith("Main");
		expect(restart).toHaveBeenCalledTimes(1);
	});

	it("restartMainScene is a no-op when game ref is missing", () => {
		useMapStore.getState().setGameRef(null);
		expect(() => useMapStore.getState().restartMainScene()).not.toThrow();
	});
});
