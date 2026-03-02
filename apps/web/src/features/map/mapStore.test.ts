import { DEFAULT_FLOOR_CONFIG } from "@app/shared";
import { describe, it, expect, beforeEach } from "vitest";
import { useMapStore } from "./mapStore";

describe("mapStore", () => {
	beforeEach(() => {
		useMapStore.setState({
			mapConfigOverride: null,
			gameRef: null,
		});
	});

	it("should have initial state", () => {
		const state = useMapStore.getState();
		expect(state.mapConfigOverride).toBeNull();
		expect(state.gameRef).toBeNull();
	});

	it("should set map config override", () => {
		const config = { ...DEFAULT_FLOOR_CONFIG, width: 20, height: 20, seed: 1 };
		useMapStore.getState().setMapConfigOverride(config);
		expect(useMapStore.getState().mapConfigOverride).toEqual(config);
	});

	it("should not throw when restartMainScene is called with no gameRef", () => {
		expect(() => useMapStore.getState().restartMainScene()).not.toThrow();
	});
});
