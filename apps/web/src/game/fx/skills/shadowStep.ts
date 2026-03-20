/**
 * Shadow Step visual effect: hero fades out, travels as a shadow, and reappears.
 */

import Phaser from "phaser";
import { idxToXY } from "@app/shared";
import { useGameStore } from "../../../features/game/gameStore";
import { TILE_WIDTH, TILE_HEIGHT } from "../../tiles/tilesetRegistry";

const FADE_MS = 100;
const TRAVEL_MS = 140;
const APPEAR_MS = 120;

export function playShadowStep(
	scene: Phaser.Scene,
	heroSprite: Phaser.GameObjects.Sprite,
	landingTileIdx: number,
	mapWidth: number,
	onImpact?: () => void,
): { newHeroTilePos: { x: number; y: number } } {
	useGameStore.getState().setActionInProgress(true);

	const { x, y } = idxToXY(landingTileIdx, mapWidth);
	const destPx = x * TILE_WIDTH + TILE_WIDTH / 2;
	const destPy = y * TILE_HEIGHT + TILE_HEIGHT / 2;

	// Fade hero to shadow
	scene.tweens.add({
		targets: heroSprite,
		alpha: 0.1,
		duration: FADE_MS,
		ease: "Sine.In",
		onComplete: () => {
			// Shadow trail at origin
			const shadow = scene.add.circle(heroSprite.x, heroSprite.y, 7, 0x221133, 0.6);
			shadow.setDepth(20);
			scene.tweens.add({
				targets: shadow,
				scaleX: 2,
				scaleY: 2,
				alpha: 0,
				duration: 250,
				ease: "Sine.Out",
				onComplete: () => shadow.destroy(),
			});

			// Teleport sprite
			heroSprite.setPosition(destPx, destPy);
			onImpact?.();

			// Reappear with purple wisps
			scene.tweens.add({
				targets: heroSprite,
				alpha: 0.4, // maintain stealth alpha
				duration: APPEAR_MS,
				ease: "Sine.Out",
				onComplete: () => {
					// Arrival wisps
					for (let i = 0; i < 5; i++) {
						const angle = (i / 5) * Math.PI * 2;
						const wisp = scene.add.circle(
							destPx + Math.cos(angle) * 10,
							destPy + Math.sin(angle) * 10,
							3,
							0x6633aa,
							0.7,
						);
						wisp.setDepth(26);
						scene.tweens.add({
							targets: wisp,
							x: destPx,
							y: destPy,
							alpha: 0,
							duration: 180,
							ease: "Sine.In",
							onComplete: () => wisp.destroy(),
						});
					}
					useGameStore.getState().setActionInProgress(false);
				},
			});
		},
	});

	// Start the travel tween immediately (no-op visually since sprite teleports)
	scene.time.delayedCall(FADE_MS + TRAVEL_MS, () => {});

	return { newHeroTilePos: { x, y } };
}
