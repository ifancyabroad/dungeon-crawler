import type Phaser from "phaser";
import { getActorAtIdx, idxToXY, xyToIdx, type Action, type GameState } from "@app/shared";
import { useGameStore } from "../../../features/game/gameStore";
import { useTargetingStore } from "../../../features/targeting/targetingStore";

type Direction = "up" | "down" | "left" | "right";

export function attachKeyboardOnline(scene: Phaser.Scene): void {
	const directionAction = (direction: Direction) => {
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

	scene.input.keyboard?.on("keydown-W", () => directionAction("up"));
	scene.input.keyboard?.on("keydown-S", () => directionAction("down"));
	scene.input.keyboard?.on("keydown-A", () => directionAction("left"));
	scene.input.keyboard?.on("keydown-D", () => directionAction("right"));
}

export function attachTargetingEscapeKey(scene: Phaser.Scene): void {
	scene.input.keyboard?.on("keydown-ESC", () => {
		if (useTargetingStore.getState().active) {
			useTargetingStore.getState().exitTargeting();
		}
	});
}

/**
 * Determine whether a WASD press should be a move or attack.
 * If a living enemy occupies the target tile, send an attack action.
 */
function resolveDirectionAction(state: GameState, direction: Direction): Action {
	const floor = state.floors[state.heroFloorIndex];
	if (!floor) return { type: "move", direction };
	const hero = floor.state.actorsById[state.heroId];
	if (!hero) return { type: "move", direction };

	const DELTA: Record<Direction, { dx: number; dy: number }> = {
		up: { dx: 0, dy: -1 },
		down: { dx: 0, dy: 1 },
		left: { dx: -1, dy: 0 },
		right: { dx: 1, dy: 0 },
	};
	const { dx, dy } = DELTA[direction];
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
