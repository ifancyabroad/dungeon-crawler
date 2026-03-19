/**
 * Lightning Bolt visual effect: an instant electric strike from hero to target tile.
 * A jagged bolt is drawn as a segmented line, flickers briefly, then disperses.
 * Calls `onImpact` when the bolt hits so deaths and damage numbers sync correctly.
 */

import Phaser from "phaser";
import { idxToXY } from "@app/shared";
import { useGameStore } from "../../../features/game/gameStore";
import { TILE_WIDTH, TILE_HEIGHT } from "../../tiles/tilesetRegistry";

const BOLT_APPEAR_MS = 40;
const BOLT_HOLD_MS = 100;
const BOLT_FADE_MS = 200;
const SEGMENTS = 8;

function jitter(max: number): number {
	return (Math.random() - 0.5) * max;
}

export function playLightningBolt(
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

	const sx = heroSprite.x;
	const sy = heroSprite.y;

	// Build jagged bolt segments as Graphics
	const gfx = scene.add.graphics();
	gfx.setDepth(28);
	drawBolt(gfx, sx, sy, targetPx, targetPy);

	// Bright white flash at impact point
	const impactFlash = scene.add.circle(targetPx, targetPy, 10, 0xffffff, 1);
	impactFlash.setDepth(30);

	// Call onImpact immediately — the bolt is instantaneous
	onImpact?.();

	// Flicker once
	scene.time.delayedCall(BOLT_APPEAR_MS, () => {
		gfx.clear();
		drawBolt(gfx, sx, sy, targetPx, targetPy, 0xaaddff, 0.6);
	});

	// Scatter sparks at target
	for (let i = 0; i < 6; i++) {
		const angle = (i / 6) * Math.PI * 2;
		const dist = 8 + i * 2;
		const spark = scene.add.circle(targetPx, targetPy, 2, 0x88ccff, 0.9);
		spark.setDepth(29);
		scene.tweens.add({
			targets: spark,
			x: targetPx + Math.cos(angle) * dist,
			y: targetPy + Math.sin(angle) * dist,
			alpha: 0,
			duration: BOLT_HOLD_MS + BOLT_FADE_MS,
			ease: "Sine.Out",
			onComplete: () => spark.destroy(),
		});
	}

	// Fade out bolt + flash
	scene.tweens.add({
		targets: [gfx, impactFlash],
		alpha: 0,
		delay: BOLT_HOLD_MS,
		duration: BOLT_FADE_MS,
		ease: "Sine.In",
		onComplete: () => {
			gfx.destroy();
			impactFlash.destroy();
			useGameStore.getState().setActionInProgress(false);
		},
	});
}

function drawBolt(
	gfx: Phaser.GameObjects.Graphics,
	sx: number,
	sy: number,
	ex: number,
	ey: number,
	color = 0xffffff,
	alpha = 1,
): void {
	gfx.clear();

	// Outer glow
	gfx.lineStyle(4, 0x4488ff, alpha * 0.4);
	drawSegmentedLine(gfx, sx, sy, ex, ey, SEGMENTS, 6);

	// Core bolt
	gfx.lineStyle(2, color, alpha);
	drawSegmentedLine(gfx, sx, sy, ex, ey, SEGMENTS, 4);
}

function drawSegmentedLine(
	gfx: Phaser.GameObjects.Graphics,
	sx: number,
	sy: number,
	ex: number,
	ey: number,
	segments: number,
	jitterMag: number,
): void {
	gfx.beginPath();
	gfx.moveTo(sx, sy);

	for (let i = 1; i < segments; i++) {
		const t = i / segments;
		const mx = sx + (ex - sx) * t + jitter(jitterMag);
		const my = sy + (ey - sy) * t + jitter(jitterMag);
		gfx.lineTo(mx, my);
	}
	gfx.lineTo(ex, ey);
	gfx.strokePath();
}
