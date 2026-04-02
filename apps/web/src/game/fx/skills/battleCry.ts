/**
 * Battle Cry visual effect: a golden shockwave ring expands from the warrior.
 */

import Phaser from "phaser";
import { useGameStore } from "../../../features/game/gameStore";

const CRY_MS = 350;

export function playBattleCry(
	scene: Phaser.Scene,
	heroSprite: Phaser.GameObjects.Sprite,
	onImpact?: () => void,
): void {
	useGameStore.getState().setActionInProgress(true);
	onImpact?.();

	// Golden expanding ring
	const ring = scene.add.circle(heroSprite.x, heroSprite.y, 8, 0xffdd44, 0.5);
	ring.setDepth(25);
	const rim = scene.add.circle(heroSprite.x, heroSprite.y, 8, 0xffee88, 0);
	rim.setStrokeStyle(2, 0xffee88, 0.9);
	rim.setDepth(26);

	scene.tweens.add({
		targets: [ring, rim],
		scaleX: 5,
		scaleY: 5,
		alpha: 0,
		duration: CRY_MS,
		ease: "Sine.Out",
		onComplete: () => {
			ring.destroy();
			rim.destroy();
			useGameStore.getState().setActionInProgress(false);
		},
	});

	// Second outer ring slightly delayed
	const outerRing = scene.add.circle(heroSprite.x, heroSprite.y, 8, 0xffcc22, 0);
	outerRing.setStrokeStyle(1, 0xffcc22, 0.7);
	outerRing.setDepth(24);
	scene.tweens.add({
		targets: outerRing,
		scaleX: 7,
		scaleY: 7,
		alpha: 0,
		duration: CRY_MS * 1.3,
		delay: 60,
		ease: "Sine.Out",
		onComplete: () => outerRing.destroy(),
	});

	// Gold flash on hero
	const flash = scene.add.circle(heroSprite.x, heroSprite.y, 10, 0xffee44, 0.7);
	flash.setDepth(27);
	scene.tweens.add({
		targets: flash,
		alpha: 0,
		scaleX: 1.5,
		scaleY: 1.5,
		duration: 180,
		ease: "Sine.Out",
		onComplete: () => flash.destroy(),
	});
}
