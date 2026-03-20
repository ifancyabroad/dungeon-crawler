/**
 * Cleave visual effect: wide arc slash radiating from the hero.
 */

import Phaser from "phaser";
import { useGameStore } from "../../../features/game/gameStore";

const SLASH_MS = 280;

export function playCleave(
	scene: Phaser.Scene,
	heroSprite: Phaser.GameObjects.Sprite,
	onImpact?: () => void,
): void {
	useGameStore.getState().setActionInProgress(true);
	onImpact?.();

	// Hero jolt
	const origX = heroSprite.x;
	scene.tweens.add({
		targets: heroSprite,
		x: origX + 4,
		duration: 60,
		ease: "Sine.InOut",
		yoyo: true,
		onComplete: () => {
			heroSprite.x = origX;
		},
	});

	// Three slash arcs expanding outward
	for (let i = 0; i < 3; i++) {
		const arc = scene.add.arc(
			heroSprite.x,
			heroSprite.y,
			10 + i * 6,
			-60,
			60,
			false,
			0xffcc44,
			0.6 - i * 0.1,
		);
		arc.setDepth(25);
		scene.tweens.add({
			targets: arc,
			scaleX: 2.2 + i * 0.3,
			scaleY: 2.2 + i * 0.3,
			alpha: 0,
			duration: SLASH_MS + i * 40,
			delay: i * 35,
			ease: "Sine.Out",
			onComplete: () => {
				arc.destroy();
				if (i === 2) useGameStore.getState().setActionInProgress(false);
			},
		});
	}
}
