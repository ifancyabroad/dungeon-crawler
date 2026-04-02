/**
 * Hemorrhage visual effect: powerful melee slash with a heavy red particle spray.
 */

import Phaser from "phaser";
import { idxToXY } from "@app/shared";
import { useGameStore } from "../../../features/game/gameStore";
import { TILE_WIDTH, TILE_HEIGHT } from "../../tiles/tilesetRegistry";

const SLASH_MS = 160;

export function playHemorrhage(
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
		x: casterSprite.x + ndx * 9,
		y: casterSprite.y + ndy * 9,
		duration: SLASH_MS / 2,
		ease: "Sine.In",
		onComplete: () => {
			onImpact?.();

			// Heavy red slash burst — larger than a normal hit
			const burst = scene.add.circle(targetPx, targetPy, 7, 0xcc1111, 0.9);
			burst.setDepth(25);
			scene.tweens.add({
				targets: burst,
				scaleX: 3.5,
				scaleY: 3.5,
				alpha: 0,
				duration: 300,
				ease: "Sine.Out",
				onComplete: () => burst.destroy(),
			});

			// Spray of red blood particles
			for (let i = 0; i < 10; i++) {
				const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
				const speed = 12 + Math.random() * 14;
				const drop = scene.add.circle(
					targetPx + (Math.random() - 0.5) * 8,
					targetPy,
					2,
					i % 2 === 0 ? 0xcc0000 : 0xff3333,
					0.9,
				);
				drop.setDepth(24);
				scene.tweens.add({
					targets: drop,
					x: drop.x + Math.cos(angle) * speed,
					y: drop.y + Math.sin(angle) * speed,
					alpha: 0,
					scaleX: 0.3,
					scaleY: 0.3,
					duration: 380 + i * 30,
					delay: i * 20,
					ease: "Quad.Out",
					onComplete: () => drop.destroy(),
				});
			}

			// Retract caster
			scene.tweens.add({
				targets: casterSprite,
				x: origX,
				y: origY,
				duration: SLASH_MS / 2,
				ease: "Sine.Out",
				onComplete: () => {
					useGameStore.getState().setActionInProgress(false);
				},
			});
		},
	});
}
