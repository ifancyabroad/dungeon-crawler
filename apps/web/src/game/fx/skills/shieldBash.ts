/**
 * Shield Bash visual effect: warrior lurches toward target with a blue shield-flash on impact.
 */

import Phaser from "phaser";
import { idxToXY } from "@app/shared";
import { useGameStore } from "../../../features/game/gameStore";
import { TILE_WIDTH, TILE_HEIGHT } from "../../tiles/tilesetRegistry";

const BASH_MS = 140;

export function playShieldBash(
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
		x: heroSprite.x + ndx * 10,
		y: heroSprite.y + ndy * 10,
		duration: BASH_MS / 2,
		ease: "Sine.In",
		onComplete: () => {
			onImpact?.();

			// Blue shield flash at impact
			const flash = scene.add.circle(targetPx, targetPy, 8, 0x4499ff, 0.9);
			flash.setDepth(26);
			scene.tweens.add({
				targets: flash,
				scaleX: 2.5,
				scaleY: 2.5,
				alpha: 0,
				duration: 250,
				ease: "Sine.Out",
				onComplete: () => flash.destroy(),
			});

			// Stun stars above target
			for (let i = 0; i < 4; i++) {
				const angle = (i / 4) * Math.PI * 2;
				const star = scene.add.circle(
					targetPx + Math.cos(angle) * 8,
					targetPy - 10,
					2,
					0xffffaa,
					1,
				);
				star.setDepth(27);
				scene.tweens.add({
					targets: star,
					x: targetPx + Math.cos(angle + 0.5) * 10,
					y: targetPy - 18,
					alpha: 0,
					duration: 400,
					delay: i * 50,
					ease: "Sine.Out",
					onComplete: () => star.destroy(),
				});
			}

			// Retract hero
			scene.tweens.add({
				targets: heroSprite,
				x: origX,
				y: origY,
				duration: BASH_MS / 2,
				ease: "Sine.Out",
				onComplete: () => {
					useGameStore.getState().setActionInProgress(false);
				},
			});
		},
	});
}
