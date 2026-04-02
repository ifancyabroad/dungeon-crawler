/**
 * Whirlwind Strike visual effect: three concentric arcs sweep a full 360° around the warrior.
 */

import Phaser from "phaser";
import { useGameStore } from "../../../features/game/gameStore";

const SPIN_MS = 300;

export function playWhirlwindStrike(
	scene: Phaser.Scene,
	heroSprite: Phaser.GameObjects.Sprite,
	onImpact?: () => void,
): void {
	useGameStore.getState().setActionInProgress(true);
	onImpact?.();

	// Hero jolt — quick shake in place
	const origX = heroSprite.x;
	scene.tweens.add({
		targets: heroSprite,
		x: origX + 3,
		duration: 50,
		ease: "Sine.InOut",
		yoyo: true,
		onComplete: () => {
			heroSprite.x = origX;
		},
	});

	// Three concentric full-circle arcs, white fading to orange
	const colors = [0xffffff, 0xffcc66, 0xff8844];
	for (let i = 0; i < 3; i++) {
		const arc = scene.add.arc(
			heroSprite.x,
			heroSprite.y,
			8 + i * 5,
			0,
			360,
			false,
			colors[i],
			0.65 - i * 0.1,
		);
		arc.setDepth(25);
		scene.tweens.add({
			targets: arc,
			scaleX: 2.4 + i * 0.4,
			scaleY: 2.4 + i * 0.4,
			alpha: 0,
			duration: SPIN_MS + i * 40,
			delay: i * 30,
			ease: "Sine.Out",
			onComplete: () => {
				arc.destroy();
				if (i === 2) useGameStore.getState().setActionInProgress(false);
			},
		});
	}

	// Dust particles bursting outward in 8 directions
	for (let i = 0; i < 8; i++) {
		const angle = (i / 8) * Math.PI * 2;
		const particle = scene.add.circle(heroSprite.x, heroSprite.y, 2, 0xddbb88, 0.8);
		particle.setDepth(24);
		scene.tweens.add({
			targets: particle,
			x: heroSprite.x + Math.cos(angle) * 22,
			y: heroSprite.y + Math.sin(angle) * 22,
			alpha: 0,
			scaleX: 0.3,
			scaleY: 0.3,
			duration: SPIN_MS * 0.9,
			delay: i * 10,
			ease: "Quad.Out",
			onComplete: () => particle.destroy(),
		});
	}
}
