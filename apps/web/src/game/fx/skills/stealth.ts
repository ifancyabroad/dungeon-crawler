/**
 * Stealth visual effect: hero fades to near-transparent with purple shimmer particles.
 * The sprite stays at alpha 0.3 while the stealth status is active.
 */

import Phaser from "phaser";
import { useGameStore } from "../../../features/game/gameStore";

const STEALTH_FADE_MS = 300;
const PARTICLE_MS = 350;

export function playStealth(scene: Phaser.Scene, heroSprite: Phaser.GameObjects.Sprite): void {
	useGameStore.getState().setActionInProgress(true);

	// Fade hero to stealth alpha
	scene.tweens.add({
		targets: heroSprite,
		alpha: 0.3,
		duration: STEALTH_FADE_MS,
		ease: "Sine.InOut",
		onComplete: () => {
			useGameStore.getState().setActionInProgress(false);
		},
	});

	// Purple/blue shimmer particles arc outward
	for (let i = 0; i < 8; i++) {
		const angle = (i / 8) * Math.PI * 2;
		const dist = 16 + Math.random() * 10;
		const particle = scene.add.circle(
			heroSprite.x,
			heroSprite.y,
			2,
			i % 2 === 0 ? 0x8844cc : 0x4466dd,
			0.9,
		);
		particle.setDepth(30);
		scene.tweens.add({
			targets: particle,
			x: heroSprite.x + Math.cos(angle) * dist,
			y: heroSprite.y + Math.sin(angle) * dist,
			alpha: 0,
			scaleX: 0.2,
			scaleY: 0.2,
			duration: PARTICLE_MS,
			delay: i * 15,
			ease: "Quad.Out",
			onComplete: () => particle.destroy(),
		});
	}
}
