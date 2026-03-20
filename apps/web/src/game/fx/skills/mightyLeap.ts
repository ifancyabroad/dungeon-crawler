/**
 * Mighty Leap visual effect: hero sprite arcs through the air, landing impact shockwave.
 */

import Phaser from "phaser";
import { idxToXY } from "@app/shared";
import { useGameStore } from "../../../features/game/gameStore";
import { TILE_WIDTH, TILE_HEIGHT } from "../../tiles/tilesetRegistry";

const LEAP_MS = 260;
const IMPACT_MS = 350;

export function playMightyLeap(
	scene: Phaser.Scene,
	heroSprite: Phaser.GameObjects.Sprite,
	landingTileIdx: number,
	mapWidth: number,
	onImpact?: () => void,
): { newHeroTilePos: { x: number; y: number } } {
	useGameStore.getState().setActionInProgress(true);

	const { x, y } = idxToXY(landingTileIdx, mapWidth);
	const destPx = x * TILE_WIDTH + TILE_WIDTH / 2;
	const destPy = y * TILE_HEIGHT + TILE_HEIGHT / 2;

	// Tween hero to landing position with a vertical arc (overshoot Y)
	const origY = heroSprite.y;
	const peakY = Math.min(origY, destPy) - 20;

	scene.tweens.add({
		targets: heroSprite,
		x: destPx,
		duration: LEAP_MS,
		ease: "Sine.InOut",
	});

	// Vertical arc: up then down
	scene.tweens.add({
		targets: heroSprite,
		y: peakY,
		duration: LEAP_MS / 2,
		ease: "Sine.Out",
		onComplete: () => {
			scene.tweens.add({
				targets: heroSprite,
				y: destPy,
				duration: LEAP_MS / 2,
				ease: "Sine.In",
				onComplete: () => {
					onImpact?.();
					landingImpact(scene, destPx, destPy);
				},
			});
		},
	});

	return { newHeroTilePos: { x, y } };
}

function landingImpact(scene: Phaser.Scene, cx: number, cy: number): void {
	// Ground shockwave rings
	for (let i = 0; i < 3; i++) {
		const ring = scene.add.circle(cx, cy, 4, 0xddbb88, 0.6 - i * 0.15);
		ring.setDepth(22);
		scene.tweens.add({
			targets: ring,
			scaleX: 5 + i * 1.5,
			scaleY: 5 + i * 1.5,
			alpha: 0,
			duration: IMPACT_MS + i * 60,
			delay: i * 50,
			ease: "Sine.Out",
			onComplete: () => {
				ring.destroy();
				if (i === 2) useGameStore.getState().setActionInProgress(false);
			},
		});
	}

	// Dust particles
	for (let i = 0; i < 8; i++) {
		const angle = (i / 8) * Math.PI * 2;
		const dist = 14 + Math.random() * 12;
		const dust = scene.add.circle(cx, cy, 3, 0xccaa77, 0.7);
		dust.setDepth(23);
		scene.tweens.add({
			targets: dust,
			x: cx + Math.cos(angle) * dist,
			y: cy + Math.sin(angle) * dist,
			alpha: 0,
			scaleX: 0.3,
			scaleY: 0.3,
			duration: IMPACT_MS * 0.7,
			ease: "Sine.Out",
			onComplete: () => dust.destroy(),
		});
	}
}
