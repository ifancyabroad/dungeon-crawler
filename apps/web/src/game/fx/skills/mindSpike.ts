/**
 * Mind Spike visual effect: a violet psychic projectile travels to the target and ripples on impact.
 */

import Phaser from "phaser";
import { useGameStore } from "../../../features/game/gameStore";

const TRAVEL_MS = 220;

export function playMindSpike(
	scene: Phaser.Scene,
	casterSprite: Phaser.GameObjects.Sprite,
	targetPx: number,
	targetPy: number,
	onImpact?: () => void,
): void {
	useGameStore.getState().setActionInProgress(true);

	// Violet bolt with trailing glow
	const trail = scene.add.circle(casterSprite.x, casterSprite.y, 5, 0x660099, 0.5);
	trail.setDepth(24);
	const bolt = scene.add.circle(casterSprite.x, casterSprite.y, 3, 0xcc44ff, 1);
	bolt.setDepth(25);

	scene.tweens.add({
		targets: [trail, bolt],
		x: targetPx,
		y: targetPy,
		duration: TRAVEL_MS,
		ease: "Quad.In",
		onComplete: () => {
			trail.destroy();
			bolt.destroy();
			onImpact?.();

			// Psychic ripple on impact — concentric rings
			for (let i = 0; i < 3; i++) {
				const ripple = scene.add.circle(targetPx, targetPy, 4, 0xaa44ff, 0);
				ripple.setStrokeStyle(1, 0xcc66ff, 0.8 - i * 0.2);
				ripple.setDepth(25);
				scene.tweens.add({
					targets: ripple,
					scaleX: 3 + i * 1.5,
					scaleY: 3 + i * 1.5,
					alpha: 0,
					duration: 280 + i * 60,
					delay: i * 50,
					ease: "Sine.Out",
					onComplete: () => {
						ripple.destroy();
						if (i === 2) useGameStore.getState().setActionInProgress(false);
					},
				});
			}
		},
	});
}
