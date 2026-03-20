/**
 * Magic Arrow visual effect: a fast-travelling arcane bolt that pierces through to target.
 */

import Phaser from "phaser";
import { idxToXY } from "@app/shared";
import { useGameStore } from "../../../features/game/gameStore";
import { TILE_WIDTH, TILE_HEIGHT } from "../../tiles/tilesetRegistry";

const TRAVEL_MS = 180;

export function playMagicArrow(
	scene: Phaser.Scene,
	heroSprite: Phaser.GameObjects.Sprite,
	targetActorWorldX: number,
	targetActorWorldY: number,
	onImpact?: () => void,
): void {
	useGameStore.getState().setActionInProgress(true);

	// Arcane bolt — small, bright blue-white core with a trailing glow
	const trail = scene.add.circle(heroSprite.x, heroSprite.y, 5, 0x8866ff, 0.6);
	trail.setDepth(24);
	const bolt = scene.add.circle(heroSprite.x, heroSprite.y, 3, 0xddeeff, 1);
	bolt.setDepth(25);

	scene.tweens.add({
		targets: [trail, bolt],
		x: targetActorWorldX,
		y: targetActorWorldY,
		duration: TRAVEL_MS,
		ease: "Quad.In",
		onComplete: () => {
			trail.destroy();
			bolt.destroy();
			onImpact?.();

			// Small arcane burst on hit
			const burst = scene.add.circle(targetActorWorldX, targetActorWorldY, 4, 0xaa88ff, 0.9);
			burst.setDepth(25);
			scene.tweens.add({
				targets: burst,
				scaleX: 3.5,
				scaleY: 3.5,
				alpha: 0,
				duration: 200,
				ease: "Sine.Out",
				onComplete: () => {
					burst.destroy();
					useGameStore.getState().setActionInProgress(false);
				},
			});
		},
	});
}

export function playMagicArrowFromIdx(
	scene: Phaser.Scene,
	heroSprite: Phaser.GameObjects.Sprite,
	targetActorIdx: number,
	mapWidth: number,
	onImpact?: () => void,
): void {
	const { x, y } = idxToXY(targetActorIdx, mapWidth);
	playMagicArrow(
		scene,
		heroSprite,
		x * TILE_WIDTH + TILE_WIDTH / 2,
		y * TILE_HEIGHT + TILE_HEIGHT / 2,
		onImpact,
	);
}
