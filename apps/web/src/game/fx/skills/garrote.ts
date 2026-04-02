/**
 * Garrote visual effect: quick melee lunge + red flash at the target's throat.
 */

import Phaser from "phaser";
import { idxToXY } from "@app/shared";
import { useGameStore } from "../../../features/game/gameStore";
import { TILE_WIDTH, TILE_HEIGHT } from "../../tiles/tilesetRegistry";

const GRAB_MS = 120;

export function playGarrote(
	scene: Phaser.Scene,
	casterSprite: Phaser.GameObjects.Sprite,
	targetActorIdx: number,
	mapWidth: number,
	onImpact?: () => void,
): void {
	useGameStore.getState().setActionInProgress(true);

	const { x, y } = idxToXY(targetActorIdx, mapWidth);
	const targetPx = x * TILE_WIDTH + TILE_WIDTH / 2;
	const targetPy = y * TILE_HEIGHT + TILE_HEIGHT / 2;

	const dx = targetPx - casterSprite.x;
	const dy = targetPy - casterSprite.y;
	const len = Math.sqrt(dx * dx + dy * dy) || 1;
	const ndx = dx / len;
	const ndy = dy / len;

	const origX = casterSprite.x;
	const origY = casterSprite.y;

	scene.tweens.add({
		targets: casterSprite,
		x: casterSprite.x + ndx * 8,
		y: casterSprite.y + ndy * 8,
		duration: GRAB_MS / 2,
		ease: "Sine.In",
		onComplete: () => {
			onImpact?.();

			// Choke flash — red-pink burst at target
			const flash = scene.add.circle(targetPx, targetPy, 5, 0xff4444, 0.85);
			flash.setDepth(25);
			scene.tweens.add({
				targets: flash,
				scaleX: 2.8,
				scaleY: 2.8,
				alpha: 0,
				duration: 200,
				ease: "Sine.Out",
				onComplete: () => flash.destroy(),
			});

			// Small horizontal line at target — the garrote wire
			const wire = scene.add.rectangle(targetPx, targetPy - 4, 10, 1, 0xff8888, 0.9);
			wire.setDepth(26);
			scene.tweens.add({
				targets: wire,
				alpha: 0,
				duration: 180,
				delay: 20,
				ease: "Sine.Out",
				onComplete: () => wire.destroy(),
			});

			// Retract caster
			scene.tweens.add({
				targets: casterSprite,
				x: origX,
				y: origY,
				duration: GRAB_MS / 2,
				ease: "Sine.Out",
				onComplete: () => {
					useGameStore.getState().setActionInProgress(false);
				},
			});
		},
	});
}
