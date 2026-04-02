/**
 * Arcane Surge visual effect: arcane rune glyphs orbit the mage as a burst of power.
 */

import Phaser from "phaser";
import { useGameStore } from "../../../features/game/gameStore";

const SURGE_MS = 500;

export function playArcaneSurge(
	scene: Phaser.Scene,
	heroSprite: Phaser.GameObjects.Sprite,
	onImpact?: () => void,
): void {
	useGameStore.getState().setActionInProgress(true);
	onImpact?.();

	// Bright blue-white inner flash
	const core = scene.add.circle(heroSprite.x, heroSprite.y, 7, 0xaaccff, 0.9);
	core.setDepth(26);
	scene.tweens.add({
		targets: core,
		scaleX: 3,
		scaleY: 3,
		alpha: 0,
		duration: 200,
		ease: "Sine.Out",
		onComplete: () => core.destroy(),
	});

	// Six glyphs (small diamonds) rotating outward then fading
	for (let i = 0; i < 6; i++) {
		const startAngle = (i / 6) * Math.PI * 2;
		const orbitR = 24;
		const glyph = scene.add.rectangle(
			heroSprite.x + Math.cos(startAngle) * orbitR,
			heroSprite.y + Math.sin(startAngle) * orbitR,
			4,
			4,
			0x88bbff,
			0.9,
		);
		glyph.setRotation(Math.PI / 4);
		glyph.setDepth(25);

		scene.tweens.add({
			targets: glyph,
			x: heroSprite.x + Math.cos(startAngle + 0.5) * (orbitR + 10),
			y: heroSprite.y + Math.sin(startAngle + 0.5) * (orbitR + 10),
			alpha: 0,
			scaleX: 0.3,
			scaleY: 0.3,
			duration: SURGE_MS,
			delay: i * 40,
			ease: "Sine.Out",
			onComplete: () => {
				glyph.destroy();
				if (i === 5) useGameStore.getState().setActionInProgress(false);
			},
		});
	}

	// Outer arcane ring
	const ring = scene.add.circle(heroSprite.x, heroSprite.y, 10, 0x6699ff, 0);
	ring.setStrokeStyle(1, 0x99ccff, 0.8);
	ring.setDepth(24);
	scene.tweens.add({
		targets: ring,
		scaleX: 4.5,
		scaleY: 4.5,
		alpha: 0,
		duration: SURGE_MS * 0.8,
		ease: "Sine.Out",
		onComplete: () => ring.destroy(),
	});
}
