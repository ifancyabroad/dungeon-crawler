import type Phaser from "phaser";
import {
	getActorAtIdx,
	idxToXY,
	xyToIdx,
	DIRECTION_DELTA,
	type Action,
	type Direction,
	type GameState,
} from "@app/shared";
import { useGameStore } from "../../../features/game/gameStore";
import { useTargetingStore } from "../../../features/targeting/targetingStore";

export function attachKeyboardOnline(scene: Phaser.Scene, onDirectionKey?: () => void): void {
	const directionAction = (direction: Direction) => {
		onDirectionKey?.();
		// Moving cancels targeting mode without sending a move action.
		if (useTargetingStore.getState().active) {
			useTargetingStore.getState().exitTargeting();
			return;
		}
		const { sendAction, state } = useGameStore.getState();
		if (!state) return;
		const action = resolveDirectionAction(state, direction);
		sendAction(action);
	};

	// WASD — cardinal directions
	scene.input.keyboard?.on("keydown-W", () => directionAction("up"));
	scene.input.keyboard?.on("keydown-S", () => directionAction("down"));
	scene.input.keyboard?.on("keydown-A", () => directionAction("left"));
	scene.input.keyboard?.on("keydown-D", () => directionAction("right"));

	// Numpad — 8 directions (5 = wait, not bound)
	scene.input.keyboard?.on("keydown-NUMPAD_EIGHT", () => directionAction("up"));
	scene.input.keyboard?.on("keydown-NUMPAD_TWO", () => directionAction("down"));
	scene.input.keyboard?.on("keydown-NUMPAD_FOUR", () => directionAction("left"));
	scene.input.keyboard?.on("keydown-NUMPAD_SIX", () => directionAction("right"));
	scene.input.keyboard?.on("keydown-NUMPAD_SEVEN", () => directionAction("up-left"));
	scene.input.keyboard?.on("keydown-NUMPAD_NINE", () => directionAction("up-right"));
	scene.input.keyboard?.on("keydown-NUMPAD_ONE", () => directionAction("down-left"));
	scene.input.keyboard?.on("keydown-NUMPAD_THREE", () => directionAction("down-right"));
}

export function attachTargetingEscapeKey(scene: Phaser.Scene): void {
	scene.input.keyboard?.on("keydown-ESC", () => {
		if (useTargetingStore.getState().active) {
			useTargetingStore.getState().exitTargeting();
		}
	});
}

/**
 * Determine whether a directional press should be a move or attack.
 * If a living enemy occupies the target tile, send an attack action.
 */
function resolveDirectionAction(state: GameState, direction: Direction): Action {
	const floor = state.floors[state.heroFloorIndex];
	if (!floor) return { type: "move", direction };
	const hero = floor.state.actorsById[state.heroId];
	if (!hero) return { type: "move", direction };

	const { dx, dy } = DIRECTION_DELTA[direction];
	const { x, y } = idxToXY(hero.idx, floor.config.width);
	const nx = x + dx;
	const ny = y + dy;
	if (nx < 0 || nx >= floor.config.width || ny < 0 || ny >= floor.config.height) {
		return { type: "move", direction };
	}
	const targetIdx = xyToIdx(nx, ny, floor.config.width);
	const enemy = getActorAtIdx(floor.state, targetIdx);
	if (enemy && enemy.id !== state.heroId) {
		return { type: "attack", direction };
	}
	return { type: "move", direction };
}
