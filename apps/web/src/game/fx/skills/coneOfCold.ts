/**
 * Cone of Cold visual effect: an icy breath spreads outward as a directional wedge.
 */

import Phaser from "phaser";
import { TILE_WIDTH, TILE_HEIGHT } from "../../tiles/tilesetRegistry";
import { useGameStore } from "../../../features/game/gameStore";

const CONE_MS = 420;
const HALF_ANGLE_RAD = Math.PI / 4; // 45° each side = 90° total arc
// 3-tile cone reach expressed in pixels
const MAX_RADIUS = 3 * Math.max(TILE_WIDTH, TILE_HEIGHT);

export function playConeOfCold(
	scene: Phaser.Scene,
	heroSprite: Phaser.GameObjects.Sprite,
	/** Direction angle in radians (atan2 from hero toward target tile). */
	dirAngle: number,
	onImpact?: () => void,
): void {
	useGameStore.getState().setActionInProgress(true);
	onImpact?.();

	// --- Expanding fan drawn via Graphics addCounter tween ---
	const gfx = scene.add.graphics();
	gfx.setPosition(heroSprite.x, heroSprite.y);
	gfx.setDepth(24);

	scene.tweens.addCounter({
		from: 0,
		to: 1,
		duration: CONE_MS,
		ease: "Quad.Out",
		onUpdate: (tween) => {
			const progress = tween.getValue() as number;
			gfx.clear();

			// Three staggered layers: inner bright core, mid fill, outer fringe
			const layers = [
				{ delay: 0.0, color: 0xaaeeff, alpha: 0.55, radiusMult: 0.7 },
				{ delay: 0.05, color: 0x66ccff, alpha: 0.4, radiusMult: 1.0 },
				{ delay: 0.1, color: 0x88ddff, alpha: 0.25, radiusMult: 1.15 },
			];

			for (const layer of layers) {
				const p = Math.max(0, progress - layer.delay) / (1 - layer.delay);
				if (p <= 0) continue;
				const radius = p * MAX_RADIUS * layer.radiusMult;
				const fade = 1 - progress;
				gfx.fillStyle(layer.color, layer.alpha * Math.max(0, fade));
				gfx.beginPath();
				gfx.moveTo(0, 0);
				gfx.arc(0, 0, radius, dirAngle - HALF_ANGLE_RAD, dirAngle + HALF_ANGLE_RAD, false);
				gfx.closePath();
				gfx.fillPath();
			}
		},
		onComplete: () => {
			gfx.destroy();
			useGameStore.getState().setActionInProgress(false);
		},
	});

	// --- Ice crystal particles shooting outward in cone arc ---
	const PARTICLE_COUNT = 14;
	for (let i = 0; i < PARTICLE_COUNT; i++) {
		const angle = dirAngle - HALF_ANGLE_RAD + (i / (PARTICLE_COUNT - 1)) * (HALF_ANGLE_RAD * 2);
		const dist = MAX_RADIUS * (0.5 + Math.random() * 0.6);
		const crystal = scene.add.circle(heroSprite.x, heroSprite.y, 2, 0xddf8ff, 0.9);
		crystal.setDepth(25);
		scene.tweens.add({
			targets: crystal,
			x: heroSprite.x + Math.cos(angle) * dist,
			y: heroSprite.y + Math.sin(angle) * dist,
			alpha: 0,
			scaleX: 0.2,
			scaleY: 0.2,
			duration: CONE_MS * 0.85,
			delay: i * 12,
			ease: "Quad.Out",
			onComplete: () => crystal.destroy(),
		});
	}
}
