/**
 * Soul Drain visual effect: a green life-drain beam from caster to target,
 * with green orbs traveling back toward the caster.
 */

import Phaser from "phaser";
import { useGameStore } from "../../../features/game/gameStore";

const DRAIN_MS = 350;

export function playSoulDrain(
	scene: Phaser.Scene,
	casterSprite: Phaser.GameObjects.Sprite,
	targetPx: number,
	targetPy: number,
	onImpact?: () => void,
): void {
	useGameStore.getState().setActionInProgress(true);
	onImpact?.();

	// Beam — drawn once, faded in then out via alpha tween on the Graphics object
	const beam = scene.add.graphics();
	beam.lineStyle(2, 0x44cc44, 1);
	beam.beginPath();
	beam.moveTo(casterSprite.x, casterSprite.y);
	beam.lineTo(targetPx, targetPy);
	beam.strokePath();
	beam.setDepth(24);
	beam.setAlpha(0);

	scene.tweens.add({
		targets: beam,
		alpha: { from: 0, to: 0.7 },
		duration: DRAIN_MS * 0.3,
		ease: "Sine.In",
		yoyo: true,
		hold: Math.floor(DRAIN_MS * 0.4),
		onComplete: () => beam.destroy(),
	});

	// Impact burst at target
	const splash = scene.add.circle(targetPx, targetPy, 5, 0x22aa22, 0.8);
	splash.setDepth(25);
	scene.tweens.add({
		targets: splash,
		scaleX: 3,
		scaleY: 3,
		alpha: 0,
		duration: 300,
		ease: "Sine.Out",
		onComplete: () => splash.destroy(),
	});

	// Life orbs traveling back toward caster
	for (let i = 0; i < 4; i++) {
		const delay = (DRAIN_MS / 5) * i;
		const orb = scene.add.circle(targetPx, targetPy, 3, 0x55ee55, 0.9);
		orb.setDepth(25);
		scene.tweens.add({
			targets: orb,
			x: casterSprite.x,
			y: casterSprite.y,
			alpha: 0,
			duration: DRAIN_MS * 0.7,
			delay,
			ease: "Quad.In",
			onComplete: () => {
				orb.destroy();
				if (i === 3) useGameStore.getState().setActionInProgress(false);
			},
		});
	}
}
