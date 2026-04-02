/**
 * Berserker Rage visual effect: blood-red pulse expanding from the warrior.
 */

import Phaser from "phaser";
import { useGameStore } from "../../../features/game/gameStore";

const RAGE_MS = 450;

export function playBerserkerRage(
	scene: Phaser.Scene,
	heroSprite: Phaser.GameObjects.Sprite,
	onImpact?: () => void,
): void {
	useGameStore.getState().setActionInProgress(true);
	onImpact?.();

	// Dark red inner pulse
	const inner = scene.add.circle(heroSprite.x, heroSprite.y, 6, 0xcc1111, 0.8);
	inner.setDepth(25);
	scene.tweens.add({
		targets: inner,
		scaleX: 3.5,
		scaleY: 3.5,
		alpha: 0,
		duration: RAGE_MS,
		ease: "Sine.Out",
		onComplete: () => {
			inner.destroy();
			useGameStore.getState().setActionInProgress(false);
		},
	});

	// Bright red outer ring
	const ring = scene.add.circle(heroSprite.x, heroSprite.y, 8, 0xff2222, 0);
	ring.setStrokeStyle(2, 0xff4444, 0.85);
	ring.setDepth(26);
	scene.tweens.add({
		targets: ring,
		scaleX: 5,
		scaleY: 5,
		alpha: 0,
		duration: RAGE_MS * 1.1,
		ease: "Sine.Out",
		onComplete: () => ring.destroy(),
	});

	// Red particles bursting outward
	for (let i = 0; i < 10; i++) {
		const angle = (i / 10) * Math.PI * 2;
		const particle = scene.add.circle(heroSprite.x, heroSprite.y, 2, 0xff3333, 0.9);
		particle.setDepth(24);
		scene.tweens.add({
			targets: particle,
			x: heroSprite.x + Math.cos(angle) * 20,
			y: heroSprite.y + Math.sin(angle) * 20,
			alpha: 0,
			scaleX: 0.3,
			scaleY: 0.3,
			duration: RAGE_MS * 0.7,
			delay: i * 15,
			ease: "Quad.Out",
			onComplete: () => particle.destroy(),
		});
	}

	// Brief red flash on hero
	const flash = scene.add.circle(heroSprite.x, heroSprite.y, 10, 0xff0000, 0.5);
	flash.setDepth(27);
	scene.tweens.add({
		targets: flash,
		alpha: 0,
		duration: 150,
		ease: "Sine.Out",
		onComplete: () => flash.destroy(),
	});
}
