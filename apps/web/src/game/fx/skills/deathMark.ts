/**
 * Death Mark visual effect: a dark curse descends on the target, pulsing with necrotic energy.
 */

import Phaser from "phaser";
import { useGameStore } from "../../../features/game/gameStore";

const MARK_MS = 500;

export function playDeathMark(
	scene: Phaser.Scene,
	targetPx: number,
	targetPy: number,
	onImpact?: () => void,
): void {
	useGameStore.getState().setActionInProgress(true);
	onImpact?.();

	// Dark descending aura rings — ring[2] finishes last (delay 160ms + 500ms), owns the lock release
	const RING_COUNT = 3;
	for (let i = 0; i < RING_COUNT; i++) {
		const ring = scene.add.circle(targetPx, targetPy - 20 + i * 4, 10 + i * 3, 0x220033, 0);
		ring.setStrokeStyle(2, 0x990099, 0.8 - i * 0.2);
		ring.setDepth(25 - i);

		scene.tweens.add({
			targets: ring,
			y: targetPy,
			scaleX: 1.8,
			scaleY: 1.8,
			alpha: 0,
			duration: MARK_MS,
			delay: i * 80,
			ease: "Sine.Out",
			onComplete: () => {
				ring.destroy();
				if (i === RING_COUNT - 1) {
					useGameStore.getState().setActionInProgress(false);
				}
			},
		});
	}

	// Core dark flash on target
	const core = scene.add.circle(targetPx, targetPy, 8, 0x660066, 0.85);
	core.setDepth(26);
	scene.tweens.add({
		targets: core,
		scaleX: 2.5,
		scaleY: 2.5,
		alpha: 0,
		duration: MARK_MS * 0.6,
		ease: "Sine.Out",
		onComplete: () => core.destroy(),
	});
}
