/**
 * Marked for Death visual effect: a red crosshair fades in above the target and pulses once.
 */

import Phaser from "phaser";
import { useGameStore } from "../../../features/game/gameStore";

const MARK_MS = 300;

export function playMarkedForDeath(
	scene: Phaser.Scene,
	targetPx: number,
	targetPy: number,
	onImpact?: () => void,
): void {
	useGameStore.getState().setActionInProgress(true);
	onImpact?.();

	// Red outer circle
	const circle = scene.add.circle(targetPx, targetPy - 6, 8, 0xff0000, 0);
	circle.setStrokeStyle(2, 0xff2222, 0);
	circle.setDepth(28);

	// Crosshair lines
	const hLine = scene.add.rectangle(targetPx, targetPy - 6, 14, 1, 0xff2222, 0);
	hLine.setDepth(28);
	const vLine = scene.add.rectangle(targetPx, targetPy - 6, 1, 14, 0xff2222, 0);
	vLine.setDepth(28);

	// Fade in
	scene.tweens.add({
		targets: [circle, hLine, vLine],
		alpha: 0.9,
		duration: MARK_MS * 0.4,
		ease: "Sine.Out",
		onComplete: () => {
			// Pulse once
			scene.tweens.add({
				targets: [circle, hLine, vLine],
				scaleX: 1.4,
				scaleY: 1.4,
				duration: MARK_MS * 0.3,
				ease: "Sine.Out",
				yoyo: true,
				onComplete: () => {
					// Fade out
					scene.tweens.add({
						targets: [circle, hLine, vLine],
						alpha: 0,
						duration: MARK_MS * 0.4,
						ease: "Sine.In",
						onComplete: () => {
							circle.destroy();
							hLine.destroy();
							vLine.destroy();
							useGameStore.getState().setActionInProgress(false);
						},
					});
				},
			});
		},
	});
}
