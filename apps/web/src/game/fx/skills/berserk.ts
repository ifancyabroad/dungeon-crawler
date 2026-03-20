/**
 * Berserk visual effect: deep red rage pulse with hero flash.
 */

import Phaser from "phaser";
import { useGameStore } from "../../../features/game/gameStore";

const BERSERK_MS = 500;

export function playBerserk(
	scene: Phaser.Scene,
	heroSprite: Phaser.GameObjects.Sprite,
	onImpact?: () => void,
): void {
	useGameStore.getState().setActionInProgress(true);
	onImpact?.();

	// Red tint flash on hero
	const flash = scene.add.circle(heroSprite.x, heroSprite.y, 10, 0xff2200, 0.75);
	flash.setDepth(30);
	scene.tweens.add({
		targets: flash,
		scaleX: 2,
		scaleY: 2,
		alpha: 0,
		duration: 200,
		ease: "Sine.Out",
		onComplete: () => flash.destroy(),
	});

	// Expanding rage rings
	for (let i = 0; i < 4; i++) {
		const ring = scene.add.circle(heroSprite.x, heroSprite.y, 6, 0xdd1100, 0.55 - i * 0.08);
		ring.setDepth(24);
		scene.tweens.add({
			targets: ring,
			scaleX: 4 + i,
			scaleY: 4 + i,
			alpha: 0,
			duration: BERSERK_MS + i * 50,
			delay: i * 70,
			ease: "Sine.Out",
			onComplete: () => {
				ring.destroy();
				if (i === 3) useGameStore.getState().setActionInProgress(false);
			},
		});
	}

	// Jagged energy sparks
	for (let i = 0; i < 8; i++) {
		const angle = (i / 8) * Math.PI * 2;
		const dist = 16 + Math.random() * 12;
		const spark = scene.add.circle(heroSprite.x, heroSprite.y, 2, 0xff5533, 0.9);
		spark.setDepth(25);
		scene.tweens.add({
			targets: spark,
			x: heroSprite.x + Math.cos(angle) * dist,
			y: heroSprite.y + Math.sin(angle) * dist,
			alpha: 0,
			scaleX: 0.2,
			scaleY: 0.2,
			duration: BERSERK_MS * 0.6,
			delay: i * 20,
			ease: "Quad.Out",
			onComplete: () => spark.destroy(),
		});
	}
}
