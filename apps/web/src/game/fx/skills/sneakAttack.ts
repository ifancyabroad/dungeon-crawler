/**
 * Sneak Attack visual effect: dark flash + swift stab with purple energy.
 */

import Phaser from "phaser";
import { idxToXY } from "@app/shared";
import { useGameStore } from "../../../features/game/gameStore";
import { TILE_WIDTH, TILE_HEIGHT } from "../../tiles/tilesetRegistry";

const STAB_MS = 200;

export function playSneakAttack(
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

	// Direction toward target
	const dx = targetPx - heroSprite.x;
	const dy = targetPy - heroSprite.y;
	const len = Math.sqrt(dx * dx + dy * dy) || 1;
	const ndx = dx / len;
	const ndy = dy / len;

	// Dark pre-strike flash
	const preFlash = scene.add.circle(heroSprite.x, heroSprite.y, 8, 0x220033, 0.8);
	preFlash.setDepth(28);
	scene.tweens.add({
		targets: preFlash,
		alpha: 0,
		duration: 100,
		ease: "Sine.Out",
		onComplete: () => preFlash.destroy(),
	});

	// Hero lunges slightly toward target
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

			// Hit burst at target
			const burst = scene.add.circle(targetPx, targetPy, 5, 0xaa44ff, 0.85);
			burst.setDepth(26);
			scene.tweens.add({
				targets: burst,
				scaleX: 3,
				scaleY: 3,
				alpha: 0,
				duration: 200,
				ease: "Sine.Out",
				onComplete: () => burst.destroy(),
			});

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
