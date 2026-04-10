/**
 * Entangle visual effect: grasping roots erupt from the ground around the caster.
 */

import Phaser from "phaser";
import { useGameStore } from "../../../features/game/gameStore";

const ENTANGLE_MS = 360;

export function playEntangle(
	scene: Phaser.Scene,
	heroSprite: Phaser.GameObjects.Sprite,
	onImpact?: () => void,
): void {
	useGameStore.getState().setActionInProgress(true);
	onImpact?.();

	// Tendrils shooting outward like frostNova but green/brown
	const TENDRIL_COUNT = 8;
	for (let i = 0; i < TENDRIL_COUNT; i++) {
		const angle = (i / TENDRIL_COUNT) * Math.PI * 2;
		const dist = 24 + Math.random() * 12;

		const tendril = scene.add.rectangle(heroSprite.x, heroSprite.y, 3, 12, 0x226600, 0.85);
		tendril.setRotation(angle + Math.PI / 2);
		tendril.setDepth(24);

		scene.tweens.add({
			targets: tendril,
			x: heroSprite.x + Math.cos(angle) * dist,
			y: heroSprite.y + Math.sin(angle) * dist,
			scaleY: 1.5,
			alpha: 0,
			duration: ENTANGLE_MS,
			delay: i * 20,
			ease: "Quad.Out",
			onComplete: () => {
				tendril.destroy();
				if (i === TENDRIL_COUNT - 1) {
					useGameStore.getState().setActionInProgress(false);
				}
			},
		});
	}

	// Expanding green ring
	const ring = scene.add.circle(heroSprite.x, heroSprite.y, 8, 0x44aa00, 0);
	ring.setStrokeStyle(3, 0x44aa00, 0.8);
	ring.setDepth(23);
	scene.tweens.add({
		targets: ring,
		scaleX: 3.5,
		scaleY: 3.5,
		alpha: 0,
		duration: ENTANGLE_MS,
		ease: "Sine.Out",
		onComplete: () => ring.destroy(),
	});

	// Green core pulse
	const core = scene.add.circle(heroSprite.x, heroSprite.y, 7, 0x66cc22, 0.8);
	core.setDepth(25);
	scene.tweens.add({
		targets: core,
		scaleX: 2,
		scaleY: 2,
		alpha: 0,
		duration: ENTANGLE_MS * 0.5,
		ease: "Sine.Out",
		onComplete: () => core.destroy(),
	});
}
