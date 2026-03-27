import { createInitialState, DEFAULT_FLOOR_CONFIG, DEFAULT_HERO_INIT } from "@app/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGameStore } from "../../../features/game/gameStore";
import { useTargetingStore } from "../../../features/targeting/targetingStore";
import { attachKeyboardOnline, attachTargetingEscapeKey } from "./inputBindings";

const sharedMocks = vi.hoisted(() => ({
	getActorAtIdx: vi.fn(),
}));

vi.mock("@app/shared", async () => {
	const actual = await vi.importActual<typeof import("@app/shared")>("@app/shared");
	return {
		...actual,
		getActorAtIdx: sharedMocks.getActorAtIdx,
	};
});

function makeScene() {
	const handlers = new Map<string, () => void>();
	return {
		handlers,
		scene: {
			input: {
				keyboard: {
					on: (event: string, cb: () => void) => handlers.set(event, cb),
				},
			},
		},
	};
}

describe("input bindings", () => {
	beforeEach(() => {
		useTargetingStore.getState().exitTargeting();
		sharedMocks.getActorAtIdx.mockReset();
		useGameStore.setState({
			gameId: "g1",
			state: createInitialState(42, [DEFAULT_FLOOR_CONFIG], DEFAULT_HERO_INIT),
			sendAction: vi.fn(),
		} as never);
	});

	it("WASD sends attack when enemy is on target tile", () => {
		const sendAction = vi.fn();
		sharedMocks.getActorAtIdx.mockReturnValue({ id: "enemy-1", alive: true });
		const state = createInitialState(42, [DEFAULT_FLOOR_CONFIG], DEFAULT_HERO_INIT);
		useGameStore.setState({
			state,
			sendAction,
		} as never);
		const mock = makeScene();
		attachKeyboardOnline(mock.scene as never);
		mock.handlers.get("keydown-D")?.();
		expect(sendAction).toHaveBeenCalledWith({ type: "attack", direction: "right" });
	});

	it("WASD exits targeting without sending action", () => {
		const sendAction = vi.fn();
		const exitSpy = vi.spyOn(useTargetingStore.getState(), "exitTargeting");
		useTargetingStore.setState({ active: true });
		useGameStore.setState({ sendAction } as never);

		const mock = makeScene();
		attachKeyboardOnline(mock.scene as never);
		mock.handlers.get("keydown-W")?.();

		expect(exitSpy).toHaveBeenCalledTimes(1);
		expect(sendAction).not.toHaveBeenCalled();
		exitSpy.mockRestore();
	});

	it("numpad diagonal sends move action", () => {
		const sendAction = vi.fn();
		useGameStore.setState({ sendAction } as never);
		const mock = makeScene();
		attachKeyboardOnline(mock.scene as never);
		mock.handlers.get("keydown-NUMPAD_NINE")?.();
		expect(sendAction).toHaveBeenCalledWith({ type: "move", direction: "up-right" });
	});

	it("ESC exits targeting mode", () => {
		useTargetingStore.setState({ active: true });
		const exitSpy = vi.spyOn(useTargetingStore.getState(), "exitTargeting");
		const mock = makeScene();
		attachTargetingEscapeKey(mock.scene as never);
		mock.handlers.get("keydown-ESC")?.();
		expect(exitSpy).toHaveBeenCalled();
		exitSpy.mockRestore();
	});
});
