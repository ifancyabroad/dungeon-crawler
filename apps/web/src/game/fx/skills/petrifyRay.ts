/**
 * Petrify Ray visual effect: a pale purple beam streaks to target, leaving them momentarily frozen.
 */

import Phaser from "phaser";
import { useGameStore } from "../../../features/game/gameStore";

const TRAVEL_MS = 160;

export function playPetrifyRay(
	scene: Phaser.Scene,
	casterSprite: Phaser.GameObjects.Sprite,
	targetPx: number,
	targetPy: number,
	onImpact?: () => void,
): void {
	useGameStore.getState().setActionInProgress(true);

	// Pale purple/grey eye ray
	const outer = scene.add.circle(casterSprite.x, casterSprite.y, 5, 0x9988bb, 0.5);
	outer.setDepth(24);
	const beam = scene.add.circle(casterSprite.x, casterSprite.y, 2, 0xddccff, 1);
	beam.setDepth(25);

	scene.tweens.add({
		targets: [outer, beam],
		x: targetPx,
		y: targetPy,
		duration: TRAVEL_MS,
		ease: "Linear",
		onComplete: () => {
			outer.destroy();
			beam.destroy();
			onImpact?.();

			// Stone-grey flash on hit — petrification effect
			const stoneBurst = scene.add.circle(targetPx, targetPy, 7, 0xaaaaaa, 0.9);
			stoneBurst.setDepth(26);
			scene.tweens.add({
				targets: stoneBurst,
				scaleX: 3,
				scaleY: 3,
				alpha: 0,
				duration: 300,
				ease: "Sine.Out",
				onComplete: () => stoneBurst.destroy(),
			});

			// Purple ripple overlay
			const ripple = scene.add.circle(targetPx, targetPy, 5, 0xaa88ff, 0.6);
			ripple.setDepth(25);
			scene.tweens.add({
				targets: ripple,
				scaleX: 2.5,
				scaleY: 2.5,
				alpha: 0,
				duration: 250,
				ease: "Sine.Out",
				onComplete: () => {
					ripple.destroy();
					useGameStore.getState().setActionInProgress(false);
				},
			});
		},
	});
}
