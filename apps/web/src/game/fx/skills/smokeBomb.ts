/**
 * Smoke Bomb visual effect: a dark cloud burst with drifting poison wisps.
 * The hero vanishes (brief fade) as the cloud expands.
 *
 * `onImpact` fires at the detonation burst so enemy poison damage numbers and
 * deaths appear immediately. The cloud and wisps continue playing afterward.
 * The hero fades back to the stealth alpha (0.4) because smoke bomb always
 * grants stealth — the store also sets this, but the tween must agree to avoid
 * overwriting it with alpha 1.
 */

import Phaser from "phaser";
import { useGameStore } from "../../../features/game/gameStore";

const BURST_MS = 80;
const CLOUD_EXPAND_MS = 380;
const WISP_DRIFT_MS = 500;
const FADE_IN_MS = 200;
/** Alpha applied to hero while stealthed (must match MainScene's stealth check). */
const STEALTH_ALPHA = 0.4;

export function playSmokeBomb(
	scene: Phaser.Scene,
	heroSprite: Phaser.GameObjects.Sprite,
	onImpact?: () => void,
): void {
	useGameStore.getState().setActionInProgress(true);

	const cx = heroSprite.x;
	const cy = heroSprite.y;

	// Instant dark flash at centre
	const core = scene.add.circle(cx, cy, 6, 0x111111, 1);
	core.setDepth(30);
	scene.tweens.add({
		targets: core,
		scaleX: 2.5,
		scaleY: 2.5,
		alpha: 0,
		duration: BURST_MS,
		ease: "Sine.Out",
		onComplete: () => core.destroy(),
	});

	// Expanding smoke cloud (semi-transparent dark green-grey)
	const cloud = scene.add.circle(cx, cy, 10, 0x2a3d1a, 0.72);
	cloud.setDepth(26);
	scene.tweens.add({
		targets: cloud,
		scaleX: 4.2,
		scaleY: 3.4,
		alpha: 0,
		duration: CLOUD_EXPAND_MS,
		ease: "Sine.Out",
		onComplete: () => cloud.destroy(),
	});

	// Outer ring of darker smoke
	const outerSmoke = scene.add.circle(cx, cy, 8, 0x1a1a1a, 0.55);
	outerSmoke.setDepth(25);
	scene.tweens.add({
		targets: outerSmoke,
		scaleX: 5.5,
		scaleY: 4.5,
		alpha: 0,
		duration: CLOUD_EXPAND_MS * 1.2,
		ease: "Sine.Out",
		onComplete: () => outerSmoke.destroy(),
	});

	// Poison wisps drifting outward
	const wispAngles = [0, 52, 105, 158, 210, 280, 330];
	wispAngles.forEach((deg, i) => {
		const angle = (deg * Math.PI) / 180;
		const dist = 18 + i * 3;
		scene.time.delayedCall(i * 25, () => {
			const wisp = scene.add.circle(cx, cy, 3, 0x44ff66, 0.8);
			wisp.setDepth(28);
			scene.tweens.add({
				targets: wisp,
				x: cx + Math.cos(angle) * dist,
				y: cy + Math.sin(angle) * dist - 6,
				scaleX: 0.3,
				scaleY: 0.3,
				alpha: 0,
				duration: WISP_DRIFT_MS,
				ease: "Sine.Out",
				onComplete: () => wisp.destroy(),
			});
		});
	});

	// Hero fades out at detonation, then reappears at the stealth alpha.
	// Fading back to STEALTH_ALPHA (not 1) keeps the visual consistent with the
	// state-driven alpha set by MainScene when the hero has the stealth status.
	scene.tweens.add({
		targets: heroSprite,
		alpha: 0.1,
		duration: BURST_MS + 40,
		ease: "Sine.In",
		onComplete: () => {
			scene.tweens.add({
				targets: heroSprite,
				alpha: STEALTH_ALPHA,
				delay: 100,
				duration: FADE_IN_MS,
				ease: "Sine.Out",
			});
		},
	});

	// Trigger impact FX (poison damage numbers, deaths) at the detonation moment.
	scene.time.delayedCall(BURST_MS, () => onImpact?.());

	// Unblock input only after cloud and wisps have fully dissipated.
	const totalMs = Math.max(CLOUD_EXPAND_MS * 1.2, WISP_DRIFT_MS) + 50;
	scene.time.delayedCall(totalMs, () => {
		useGameStore.getState().setActionInProgress(false);
	});
}
