/**
 * Gust Slam visual effect: a violent wind burst radiates outward from the caster.
 */

import Phaser from "phaser";
import { useGameStore } from "../../../features/game/gameStore";

const BURST_MS = 380;

export function playGustSlam(
	scene: Phaser.Scene,
	heroSprite: Phaser.GameObjects.Sprite,
	onImpact?: () => void,
): void {
	useGameStore.getState().setActionInProgress(true);
	onImpact?.();

	// Expanding wind rings
	const ringColors = [0xddeeff, 0xaaccee, 0x88aacc];
	for (let i = 0; i < ringColors.length; i++) {
		const ring = scene.add.circle(heroSprite.x, heroSprite.y, 6 + i * 4, ringColors[i], 0);
		ring.setStrokeStyle(2, ringColors[i], 0.7 - i * 0.15);
		ring.setDepth(24);
		scene.tweens.add({
			targets: ring,
			scaleX: 5 + i * 1.5,
			scaleY: 5 + i * 1.5,
			alpha: 0,
			duration: BURST_MS + i * 60,
			delay: i * 40,
			ease: "Sine.Out",
			onComplete: () => {
				ring.destroy();
				if (i === ringColors.length - 1) {
					useGameStore.getState().setActionInProgress(false);
				}
			},
		});
	}

	// Wind streak particles shooting outward
	const PARTICLE_COUNT = 12;
	for (let i = 0; i < PARTICLE_COUNT; i++) {
		const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
		const dist = 40 + Math.random() * 24;
		const streak = scene.add.rectangle(heroSprite.x, heroSprite.y, 2, 8, 0xccddff, 0.75);
		streak.setRotation(angle + Math.PI / 2);
		streak.setDepth(25);
		scene.tweens.add({
			targets: streak,
			x: heroSprite.x + Math.cos(angle) * dist,
			y: heroSprite.y + Math.sin(angle) * dist,
			alpha: 0,
			duration: BURST_MS * 0.7,
			delay: i * 10,
			ease: "Quad.Out",
			onComplete: () => streak.destroy(),
		});
	}

	// Bright white core flash
	const core = scene.add.circle(heroSprite.x, heroSprite.y, 8, 0xffffff, 0.85);
	core.setDepth(26);
	scene.tweens.add({
		targets: core,
		scaleX: 3,
		scaleY: 3,
		alpha: 0,
		duration: BURST_MS * 0.5,
		ease: "Sine.Out",
		onComplete: () => core.destroy(),
	});
}
