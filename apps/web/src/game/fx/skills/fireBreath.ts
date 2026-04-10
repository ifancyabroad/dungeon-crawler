/**
 * Fire Breath visual effect: a massive torrent of dragonfire erupts in a wide cone.
 */

import Phaser from "phaser";
import { TILE_WIDTH, TILE_HEIGHT } from "../../tiles/tilesetRegistry";
import { useGameStore } from "../../../features/game/gameStore";

const CONE_MS = 560;
// 60° each side = 120° total
const HALF_ANGLE_RAD = Math.PI / 3;
const MAX_RADIUS = 4.5 * Math.max(TILE_WIDTH, TILE_HEIGHT);

export function playFireBreath(
	scene: Phaser.Scene,
	casterSprite: Phaser.GameObjects.Sprite,
	/** Direction angle in radians (atan2 from caster toward target tile). */
	dirAngle: number,
	onImpact?: () => void,
): void {
	useGameStore.getState().setActionInProgress(true);
	onImpact?.();

	const gfx = scene.add.graphics();
	gfx.setPosition(casterSprite.x, casterSprite.y);
	gfx.setDepth(24);

	scene.tweens.addCounter({
		from: 0,
		to: 1,
		duration: CONE_MS,
		ease: "Quad.Out",
		onUpdate: (tween) => {
			const progress = tween.getValue() as number;
			gfx.clear();

			// Four layers for more intense dragon breath
			const layers = [
				{ delay: 0.0, color: 0xcc1100, alpha: 0.6, radiusMult: 0.6 },
				{ delay: 0.04, color: 0xff3300, alpha: 0.5, radiusMult: 0.85 },
				{ delay: 0.08, color: 0xff6600, alpha: 0.4, radiusMult: 1.0 },
				{ delay: 0.12, color: 0xffaa00, alpha: 0.25, radiusMult: 1.15 },
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

	// Dense fire ember particles
	const PARTICLE_COUNT = 22;
	for (let i = 0; i < PARTICLE_COUNT; i++) {
		const angle = dirAngle - HALF_ANGLE_RAD + (i / (PARTICLE_COUNT - 1)) * (HALF_ANGLE_RAD * 2);
		const dist = MAX_RADIUS * (0.4 + Math.random() * 0.65);
		const color = Math.random() > 0.5 ? 0xffcc00 : 0xff6600;
		const ember = scene.add.circle(
			casterSprite.x,
			casterSprite.y,
			2 + Math.random() * 2,
			color,
			0.9,
		);
		ember.setDepth(25);
		scene.tweens.add({
			targets: ember,
			x: casterSprite.x + Math.cos(angle) * dist,
			y: casterSprite.y + Math.sin(angle) * dist,
			alpha: 0,
			scaleX: 0.1,
			scaleY: 0.1,
			duration: CONE_MS * 0.8,
			delay: i * 10,
			ease: "Quad.Out",
			onComplete: () => ember.destroy(),
		});
	}
}
