/**
 * Caltrops visual effect: metallic glints scatter outward in 8 directions from the caster.
 */

import Phaser from "phaser";
import { useGameStore } from "../../../features/game/gameStore";

const SCATTER_MS = 200;

export function playCaltrops(
	scene: Phaser.Scene,
	heroSprite: Phaser.GameObjects.Sprite,
	onImpact?: () => void,
): void {
	useGameStore.getState().setActionInProgress(true);
	onImpact?.();

	// 8 metallic sparks scatter in cardinal + diagonal directions
	for (let i = 0; i < 8; i++) {
		const angle = (i / 8) * Math.PI * 2;
		const dist = 18 + Math.random() * 8;
		const landX = heroSprite.x + Math.cos(angle) * dist;
		const landY = heroSprite.y + Math.sin(angle) * dist;

		const spark = scene.add.rectangle(heroSprite.x, heroSprite.y, 3, 3, 0xcccccc, 0.95);
		spark.setRotation(angle);
		spark.setDepth(24);

		scene.tweens.add({
			targets: spark,
			x: landX,
			y: landY,
			duration: SCATTER_MS,
			delay: i * 12,
			ease: "Quad.Out",
			onComplete: () => {
				// Small metallic glint at landing
				const glint = scene.add.circle(landX, landY, 2, 0xffffff, 0.8);
				glint.setDepth(23);
				scene.tweens.add({
					targets: glint,
					alpha: 0,
					duration: 200,
					ease: "Sine.Out",
					onComplete: () => glint.destroy(),
				});
				spark.destroy();
				if (i === 7) useGameStore.getState().setActionInProgress(false);
			},
		});
	}

	// Central toss flash
	const center = scene.add.circle(heroSprite.x, heroSprite.y, 5, 0xaaaaaa, 0.6);
	center.setDepth(25);
	scene.tweens.add({
		targets: center,
		alpha: 0,
		scaleX: 2,
		scaleY: 2,
		duration: 150,
		ease: "Sine.Out",
		onComplete: () => center.destroy(),
	});
}
