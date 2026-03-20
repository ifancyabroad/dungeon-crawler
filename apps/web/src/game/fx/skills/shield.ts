/**
 * Shield visual effect: a glowing magical barrier forms around the hero.
 */

import Phaser from "phaser";
import { useGameStore } from "../../../features/game/gameStore";

const SHIELD_ANIM_MS = 450;

export function playShield(
	scene: Phaser.Scene,
	heroSprite: Phaser.GameObjects.Sprite,
	onImpact?: () => void,
): void {
	useGameStore.getState().setActionInProgress(true);
	onImpact?.();

	// Expanding translucent ring in icy blue
	const ring = scene.add.circle(heroSprite.x, heroSprite.y, 6, 0x44aaff, 0.5);
	ring.setDepth(30);
	const rim = scene.add.circle(heroSprite.x, heroSprite.y, 6, 0xaaddff, 0);
	rim.setStrokeStyle(2, 0xaaddff, 0.9);
	rim.setDepth(31);

	// Quick flash on hero
	const flash = scene.add.circle(heroSprite.x, heroSprite.y, 8, 0xffffff, 0.7);
	flash.setDepth(32);
	scene.tweens.add({
		targets: flash,
		alpha: 0,
		duration: 150,
		ease: "Sine.Out",
		onComplete: () => flash.destroy(),
	});

	scene.tweens.add({
		targets: [ring, rim],
		scaleX: 4,
		scaleY: 4,
		alpha: 0,
		duration: SHIELD_ANIM_MS,
		ease: "Sine.Out",
		onComplete: () => {
			ring.destroy();
			rim.destroy();
			useGameStore.getState().setActionInProgress(false);
		},
	});

	// Orbiting sparkles
	for (let i = 0; i < 6; i++) {
		const angle = (i / 6) * Math.PI * 2;
		const radius = 18;
		const spark = scene.add.circle(
			heroSprite.x + Math.cos(angle) * radius,
			heroSprite.y + Math.sin(angle) * radius,
			2,
			0x88ddff,
			0.9,
		);
		spark.setDepth(31);
		scene.tweens.add({
			targets: spark,
			alpha: 0,
			scaleX: 0.1,
			scaleY: 0.1,
			duration: SHIELD_ANIM_MS * 0.8,
			delay: i * 30,
			ease: "Sine.In",
			onComplete: () => spark.destroy(),
		});
	}
}
