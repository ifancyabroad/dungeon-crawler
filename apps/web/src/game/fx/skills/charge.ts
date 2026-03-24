/**
 * Charge visual effect: fast hero sprite tween to the landing tile.
 * Intentionally snappier than a normal move tween to convey explosive speed.
 * Calls `onComplete` just before input is unblocked so callers can sync
 * NPC deaths and other deferred FX.
 */

import Phaser from "phaser";
import { useGameStore } from "../../../features/game/gameStore";

/** ms — noticeably faster than a standard move tween. */
const CHARGE_DURATION_MS = 70;

export function playCharge(
	scene: Phaser.Scene,
	heroSprite: Phaser.GameObjects.Sprite,
	toX: number,
	toY: number,
	onComplete?: () => void,
): void {
	useGameStore.getState().setActionInProgress(true);

	scene.tweens.add({
		targets: heroSprite,
		x: toX,
		y: toY,
		duration: CHARGE_DURATION_MS,
		ease: "Sine.In",
		onComplete: () => {
			onComplete?.();
			useGameStore.getState().setActionInProgress(false);
		},
	});
}
