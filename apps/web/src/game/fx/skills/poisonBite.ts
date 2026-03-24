/**
 * Poison Bite visual effect: a contact bite that injects venom.
 *
 * Unlike hero melee skills, this effect does NOT tween the caster sprite — the
 * NPC sprite position is managed by syncNpcs and must not be displaced.
 * Instead the animation plays entirely at the target's tile so it is safe to
 * use as a fire-and-forget effect for both hero and NPC casters.
 */

import Phaser from "phaser";

export function playPoisonBite(
	scene: Phaser.Scene,
	targetWorldX: number,
	targetWorldY: number,
	onImpact?: () => void,
): void {
	onImpact?.();

	// Green impact burst at target
	const splash = scene.add.circle(targetWorldX, targetWorldY, 4, 0x44dd44, 0.9);
	splash.setDepth(25);
	scene.tweens.add({
		targets: splash,
		scaleX: 3,
		scaleY: 3,
		alpha: 0,
		duration: 240,
		ease: "Sine.Out",
		onComplete: () => splash.destroy(),
	});

	// Poison wisps drifting upward
	for (let i = 0; i < 4; i++) {
		const wispX = targetWorldX + (i % 2 === 0 ? -1 : 1) * (4 + i * 3);
		const wisp = scene.add.circle(wispX, targetWorldY, 2, 0x33aa33, 0.75);
		wisp.setDepth(24);
		scene.tweens.add({
			targets: wisp,
			y: targetWorldY - 12 - i * 3,
			alpha: 0,
			duration: 320 + i * 40,
			delay: i * 30,
			ease: "Sine.Out",
			onComplete: () => wisp.destroy(),
		});
	}
}
