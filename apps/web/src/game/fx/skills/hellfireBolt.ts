/**
 * Hellfire Bolt visual effect: an infernal fire bolt streaks toward the target, leaving a burning trail.
 */

import Phaser from "phaser";
import { useGameStore } from "../../../features/game/gameStore";

const TRAVEL_MS = 190;

export function playHellfireBolt(
	scene: Phaser.Scene,
	casterSprite: Phaser.GameObjects.Sprite,
	targetPx: number,
	targetPy: number,
	onImpact?: () => void,
): void {
	useGameStore.getState().setActionInProgress(true);

	// Deep orange-red core with fiery outer glow
	const glow = scene.add.circle(casterSprite.x, casterSprite.y, 6, 0xff4400, 0.55);
	glow.setDepth(24);
	const bolt = scene.add.circle(casterSprite.x, casterSprite.y, 3, 0xff9900, 1);
	bolt.setDepth(25);

	scene.tweens.add({
		targets: [glow, bolt],
		x: targetPx,
		y: targetPy,
		duration: TRAVEL_MS,
		ease: "Quad.In",
		onComplete: () => {
			glow.destroy();
			bolt.destroy();
			onImpact?.();

			// Fire explosion on impact
			const burst = scene.add.circle(targetPx, targetPy, 6, 0xff6600, 0.9);
			burst.setDepth(25);
			scene.tweens.add({
				targets: burst,
				scaleX: 4,
				scaleY: 4,
				alpha: 0,
				duration: 260,
				ease: "Sine.Out",
				onComplete: () => burst.destroy(),
			});

			// Orange embers
			for (let i = 0; i < 5; i++) {
				const angle = Math.random() * Math.PI * 2;
				const dist = 8 + Math.random() * 10;
				const ember = scene.add.circle(targetPx, targetPy, 2, 0xffaa00, 0.9);
				ember.setDepth(26);
				scene.tweens.add({
					targets: ember,
					x: targetPx + Math.cos(angle) * dist,
					y: targetPy + Math.sin(angle) * dist - 8,
					alpha: 0,
					duration: 300,
					delay: i * 20,
					ease: "Quad.Out",
					onComplete: () => {
						ember.destroy();
						if (i === 4) useGameStore.getState().setActionInProgress(false);
					},
				});
			}
		},
	});
}
