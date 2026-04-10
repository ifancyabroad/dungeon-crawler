/**
 * Death Bolt visual effect: a dark necrotic bolt that tears through the target.
 */

import Phaser from "phaser";
import { useGameStore } from "../../../features/game/gameStore";

const TRAVEL_MS = 200;

export function playDeathBolt(
	scene: Phaser.Scene,
	casterSprite: Phaser.GameObjects.Sprite,
	targetPx: number,
	targetPy: number,
	onImpact?: () => void,
): void {
	useGameStore.getState().setActionInProgress(true);

	// Dark purple necrotic bolt
	const trail = scene.add.circle(casterSprite.x, casterSprite.y, 5, 0x440066, 0.6);
	trail.setDepth(24);
	const bolt = scene.add.circle(casterSprite.x, casterSprite.y, 3, 0xaa44dd, 1);
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

			// Dark necrotic burst on impact
			const burst = scene.add.circle(targetPx, targetPy, 5, 0x880088, 0.9);
			burst.setDepth(25);
			scene.tweens.add({
				targets: burst,
				scaleX: 3.5,
				scaleY: 3.5,
				alpha: 0,
				duration: 220,
				ease: "Sine.Out",
				onComplete: () => {
					burst.destroy();
					useGameStore.getState().setActionInProgress(false);
				},
			});
		},
	});
}
