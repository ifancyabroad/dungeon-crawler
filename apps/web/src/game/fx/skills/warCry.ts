/**
 * War Cry visual effect: concentric thunder shockwaves expanding from the hero.
 * Conveys a raw, ground-shaking battle cry with ripple rings and flash.
 *
 * `onImpact` fires at the initial burst so deaths and damage numbers sync with
 * the explosion. The shockwave rings continue playing after that call.
 */

import Phaser from "phaser";
import { useGameStore } from "../../../features/game/gameStore";

const RING_EXPAND_MS = 420;
const STAGGER_MS = 80;
const NUM_RINGS = 3;
/** Delay before onImpact fires — just after the initial flash hits. */
const IMPACT_DELAY_MS = 40;

export function playWarCry(
	scene: Phaser.Scene,
	heroSprite: Phaser.GameObjects.Sprite,
	onImpact?: () => void,
): void {
	useGameStore.getState().setActionInProgress(true);

	const cx = heroSprite.x;
	const cy = heroSprite.y;

	// White flash burst at hero centre
	const flash = scene.add.circle(cx, cy, 8, 0xffffff, 1);
	flash.setDepth(30);
	scene.tweens.add({
		targets: flash,
		scaleX: 2.2,
		scaleY: 2.2,
		alpha: 0,
		duration: RING_EXPAND_MS * 0.35,
		ease: "Sine.Out",
		onComplete: () => flash.destroy(),
	});

	// Hero sprite jolt — quick scale-up/down for impact feel
	scene.tweens.add({
		targets: heroSprite,
		scaleX: 1.25,
		scaleY: 0.8,
		duration: 60,
		ease: "Sine.Out",
		yoyo: true,
		onComplete: () => {
			heroSprite.setScale(1, 1);
		},
	});

	// Trigger impact FX (deaths, damage numbers, NPC sync) at the burst moment,
	// not at the end of the rings — the shockwave hits instantly.
	scene.time.delayedCall(IMPACT_DELAY_MS, () => onImpact?.());

	// Staggered shockwave rings expanding outward
	for (let i = 0; i < NUM_RINGS; i++) {
		const delay = i * STAGGER_MS;
		const color = i === 0 ? 0xffd700 : i === 1 ? 0xff8800 : 0xffeeaa;
		const startAlpha = 0.75 - i * 0.15;
		const expandScale = 5.5 + i * 1.2;

		scene.time.delayedCall(delay, () => {
			const ring = scene.add.circle(cx, cy, 7, color, startAlpha);
			ring.setStrokeStyle(2, color, startAlpha);
			ring.setDepth(27 - i);

			scene.tweens.add({
				targets: ring,
				scaleX: expandScale,
				scaleY: expandScale,
				alpha: 0,
				duration: RING_EXPAND_MS,
				ease: "Sine.Out",
				onComplete: () => ring.destroy(),
			});
		});
	}

	// Small impact sparks flying outward in a star pattern
	const sparkCount = 6;
	for (let i = 0; i < sparkCount; i++) {
		const angle = (i / sparkCount) * Math.PI * 2 + Math.PI / 6;
		const dist = 20 + i * 3;
		const spark = scene.add.rectangle(cx, cy, 3, 3, 0xffd700, 0.9);
		spark.setDepth(29);
		scene.tweens.add({
			targets: spark,
			x: cx + Math.cos(angle) * dist,
			y: cy + Math.sin(angle) * dist,
			alpha: 0,
			scaleX: 0.2,
			scaleY: 0.2,
			duration: RING_EXPAND_MS * 0.65,
			ease: "Sine.Out",
			onComplete: () => spark.destroy(),
		});
	}

	// Unblock input only after all rings have finished playing.
	const totalMs = (NUM_RINGS - 1) * STAGGER_MS + RING_EXPAND_MS;
	scene.time.delayedCall(totalMs, () => {
		useGameStore.getState().setActionInProgress(false);
	});
}
