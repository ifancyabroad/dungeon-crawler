/**
 * Reckless Attack visual effect: red tint on caster, lunge toward target, impact sparks.
 * onImpact is called at the lunge apex so damage numbers sync with the visual strike.
 */

import Phaser from "phaser";
import { useGameStore } from "../../../features/game/gameStore";

const LUNGE_OUT_MS = 80;
const LUNGE_BACK_MS = 60;
const TINT_LINGER_MS = 200;

export function playRecklessAttack(
	scene: Phaser.Scene,
	heroSprite: Phaser.GameObjects.Sprite,
	targetPx: number,
	targetPy: number,
	onImpact?: () => void,
): void {
	useGameStore.getState().setActionInProgress(true);

	const originX = heroSprite.x;
	const originY = heroSprite.y;

	// Red tint overlay on caster
	const tint = scene.add.circle(heroSprite.x, heroSprite.y, 10, 0xcc1100, 0.5);
	tint.setDepth(29);

	// Compute 30% lunge toward target
	const dx = targetPx - originX;
	const dy = targetPy - originY;
	const dist = Math.sqrt(dx * dx + dy * dy);
	const lungeX = originX + (dx / dist) * Math.min(dist * 0.3, 20);
	const lungeY = originY + (dy / dist) * Math.min(dist * 0.3, 20);

	// Lunge toward target
	scene.tweens.add({
		targets: heroSprite,
		x: lungeX,
		y: lungeY,
		duration: LUNGE_OUT_MS,
		ease: "Sine.In",
		onComplete: () => {
			onImpact?.();

			// Impact sparks at target position
			for (let i = 0; i < 6; i++) {
				const angle = (i / 6) * Math.PI * 2;
				const spark = scene.add.circle(
					targetPx,
					targetPy,
					2,
					i % 2 === 0 ? 0xff3300 : 0xff8800,
					0.9,
				);
				spark.setDepth(30);
				scene.tweens.add({
					targets: spark,
					x: targetPx + Math.cos(angle) * (10 + Math.random() * 8),
					y: targetPy + Math.sin(angle) * (10 + Math.random() * 8),
					alpha: 0,
					scaleX: 0.1,
					scaleY: 0.1,
					duration: 200,
					ease: "Quad.Out",
					onComplete: () => spark.destroy(),
				});
			}

			// Return hero to origin
			scene.tweens.add({
				targets: heroSprite,
				x: originX,
				y: originY,
				duration: LUNGE_BACK_MS,
				ease: "Sine.Out",
				onComplete: () => {
					// Tint persists briefly as visual AC penalty cue, then fades
					scene.tweens.add({
						targets: tint,
						x: originX,
						y: originY,
						alpha: 0,
						duration: TINT_LINGER_MS,
						ease: "Sine.In",
						onComplete: () => {
							tint.destroy();
							useGameStore.getState().setActionInProgress(false);
						},
					});
				},
			});
		},
	});
}
