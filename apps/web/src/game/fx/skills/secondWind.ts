/**
 * Second Wind visual effect: a warm golden ring expands from the hero with upward particles.
 */

import Phaser from "phaser";
import { useGameStore } from "../../../features/game/gameStore";

const SECOND_WIND_MS = 450;

export function playSecondWind(
	scene: Phaser.Scene,
	heroSprite: Phaser.GameObjects.Sprite,
	onImpact?: () => void,
): void {
	useGameStore.getState().setActionInProgress(true);
	onImpact?.();

	// Expanding warm golden ring
	const ring = scene.add.circle(heroSprite.x, heroSprite.y, 6, 0xffcc44, 0.5);
	ring.setDepth(30);
	const rim = scene.add.circle(heroSprite.x, heroSprite.y, 6, 0xffee88, 0);
	rim.setStrokeStyle(2, 0xffee88, 0.9);
	rim.setDepth(31);

	scene.tweens.add({
		targets: [ring, rim],
		scaleX: 4,
		scaleY: 4,
		alpha: 0,
		duration: SECOND_WIND_MS,
		ease: "Sine.Out",
		onComplete: () => {
			ring.destroy();
			rim.destroy();
			useGameStore.getState().setActionInProgress(false);
		},
	});

	// White flash overlay on hero
	const flash = scene.add.circle(heroSprite.x, heroSprite.y, 8, 0xffffff, 0.6);
	flash.setDepth(32);
	scene.tweens.add({
		targets: flash,
		alpha: 0,
		duration: 100,
		ease: "Sine.Out",
		onComplete: () => flash.destroy(),
	});

	// 8 upward white/yellow particles
	for (let i = 0; i < 8; i++) {
		const spread = (Math.random() - 0.5) * 20;
		const particle = scene.add.circle(
			heroSprite.x + spread,
			heroSprite.y,
			2,
			i % 2 === 0 ? 0xffffff : 0xffdd66,
			0.9,
		);
		particle.setDepth(31);
		scene.tweens.add({
			targets: particle,
			x: heroSprite.x + spread + (Math.random() - 0.5) * 10,
			y: heroSprite.y - 20 - Math.random() * 15,
			alpha: 0,
			scaleX: 0.2,
			scaleY: 0.2,
			duration: SECOND_WIND_MS * 0.9,
			delay: i * 20,
			ease: "Quad.Out",
			onComplete: () => particle.destroy(),
		});
	}
}
