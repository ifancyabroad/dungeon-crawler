/**
 * Fireball visual effects: projectile travel + explosion.
 * Blocks player input for the full duration; calls `onImpact` the moment the
 * projectile lands so that death FX and NPC sync play with the explosion.
 */

import Phaser from "phaser";
import { idxToXY } from "@app/shared";
import { useGameStore } from "../../../features/game/gameStore";
import { TILE_WIDTH, TILE_HEIGHT } from "../../tiles/tilesetRegistry";

const FIREBALL_TRAVEL_MS = 300;
const FIREBALL_EXPLODE_MS = 380;

export function playFireball(
	scene: Phaser.Scene,
	heroSprite: Phaser.GameObjects.Sprite,
	targetTileIdx: number,
	mapWidth: number,
	onImpact?: () => void,
): void {
	useGameStore.getState().setActionInProgress(true);

	const { x: tx, y: ty } = idxToXY(targetTileIdx, mapWidth);
	const targetPx = tx * TILE_WIDTH + TILE_WIDTH / 2;
	const targetPy = ty * TILE_HEIGHT + TILE_HEIGHT / 2;

	const outer = scene.add.circle(heroSprite.x, heroSprite.y, 7, 0xff6600, 1);
	outer.setDepth(25);
	const core = scene.add.circle(heroSprite.x, heroSprite.y, 4, 0xffee00, 1);
	core.setDepth(26);

	scene.tweens.add({
		targets: [outer, core],
		x: targetPx,
		y: targetPy,
		duration: FIREBALL_TRAVEL_MS,
		ease: "Sine.InOut",
		onComplete: () => {
			outer.destroy();
			core.destroy();
			onImpact?.();
			explode(scene, targetPx, targetPy);
		},
	});
}

function explode(scene: Phaser.Scene, cx: number, cy: number): void {
	// Expanding shockwave ring — its completion unblocks input.
	const ring = scene.add.circle(cx, cy, 6, 0xff4400, 0.85);
	ring.setDepth(25);
	scene.tweens.add({
		targets: ring,
		scaleX: 5.5,
		scaleY: 5.5,
		alpha: 0,
		duration: FIREBALL_EXPLODE_MS,
		ease: "Sine.Out",
		onComplete: () => {
			ring.destroy();
			useGameStore.getState().setActionInProgress(false);
		},
	});

	const flash = scene.add.circle(cx, cy, 9, 0xffffff, 1);
	flash.setDepth(26);
	scene.tweens.add({
		targets: flash,
		scaleX: 2.5,
		scaleY: 2.5,
		alpha: 0,
		duration: FIREBALL_EXPLODE_MS * 0.45,
		ease: "Sine.Out",
		onComplete: () => flash.destroy(),
	});

	// Embers flying outward at uniform angles
	for (let i = 0; i < 8; i++) {
		const angle = (i / 8) * Math.PI * 2;
		const dist = 22 + Math.random() * 18;
		const ember = scene.add.circle(cx, cy, 3, 0xff7700, 0.9);
		ember.setDepth(24);
		scene.tweens.add({
			targets: ember,
			x: cx + Math.cos(angle) * dist,
			y: cy + Math.sin(angle) * dist,
			alpha: 0,
			scaleX: 0.2,
			scaleY: 0.2,
			duration: FIREBALL_EXPLODE_MS * 0.75,
			ease: "Sine.Out",
			onComplete: () => ember.destroy(),
		});
	}
}
