/**
 * Poison Blade visual effect: quick melee lunge + green poison cloud.
 */

import Phaser from "phaser";
import { idxToXY } from "@app/shared";
import { useGameStore } from "../../../features/game/gameStore";
import { TILE_WIDTH, TILE_HEIGHT } from "../../tiles/tilesetRegistry";

const STAB_MS = 160;

export function playPoisonBlade(
	scene: Phaser.Scene,
	heroSprite: Phaser.GameObjects.Sprite,
	targetActorIdx: number,
	mapWidth: number,
	onImpact?: () => void,
): void {
	useGameStore.getState().setActionInProgress(true);

	const { x, y } = idxToXY(targetActorIdx, mapWidth);
	const targetPx = x * TILE_WIDTH + TILE_WIDTH / 2;
	const targetPy = y * TILE_HEIGHT + TILE_HEIGHT / 2;

	const dx = targetPx - heroSprite.x;
	const dy = targetPy - heroSprite.y;
	const len = Math.sqrt(dx * dx + dy * dy) || 1;
	const ndx = dx / len;
	const ndy = dy / len;

	const origX = heroSprite.x;
	const origY = heroSprite.y;

	scene.tweens.add({
		targets: heroSprite,
		x: heroSprite.x + ndx * 8,
		y: heroSprite.y + ndy * 8,
		duration: STAB_MS / 2,
		ease: "Sine.In",
		onComplete: () => {
			onImpact?.();

			// Green poison splash at target
			const splash = scene.add.circle(targetPx, targetPy, 5, 0x44cc44, 0.85);
			splash.setDepth(25);
			scene.tweens.add({
				targets: splash,
				scaleX: 3.5,
				scaleY: 3.5,
				alpha: 0,
				duration: 280,
				ease: "Sine.Out",
				onComplete: () => splash.destroy(),
			});

			// Poison wisps drifting upward
			for (let i = 0; i < 5; i++) {
				const wispX = targetPx + (Math.random() - 0.5) * 16;
				const wisp = scene.add.circle(wispX, targetPy, 3, 0x33aa33, 0.7);
				wisp.setDepth(24);
				scene.tweens.add({
					targets: wisp,
					y: targetPy - 14 - i * 4,
					alpha: 0,
					duration: 350 + i * 50,
					delay: i * 40,
					ease: "Sine.Out",
					onComplete: () => wisp.destroy(),
				});
			}

			// Retract hero
			scene.tweens.add({
				targets: heroSprite,
				x: origX,
				y: origY,
				duration: STAB_MS / 2,
				ease: "Sine.Out",
				onComplete: () => {
					useGameStore.getState().setActionInProgress(false);
				},
			});
		},
	});
}
