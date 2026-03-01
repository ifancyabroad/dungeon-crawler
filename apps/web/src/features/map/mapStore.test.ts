import { describe, it, expect, beforeEach } from "vitest";
import { useMapStore } from "./mapStore";

describe("mapStore", () => {
	beforeEach(() => {
		useMapStore.setState({
			mapConfigOverride: null,
			gameRef: null,
			debugMode: false,
		});
	});

	it("should have initial state", () => {
		const state = useMapStore.getState();
		expect(state.mapConfigOverride).toBeNull();
		expect(state.gameRef).toBeNull();
		expect(state.debugMode).toBe(false);
	});

	it("should set map config override", () => {
		const config = { width: 20, height: 20, seed: 1, theme: "green_forest" };
		useMapStore.getState().setMapConfigOverride(config);
		expect(useMapStore.getState().mapConfigOverride).toEqual(config);
	});

	it("should set debug mode", () => {
		useMapStore.getState().setDebugMode(true);
		expect(useMapStore.getState().debugMode).toBe(true);
	});
});
