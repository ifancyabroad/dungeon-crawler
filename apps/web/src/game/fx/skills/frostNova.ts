/**
 * Frost Nova visual effect: ice shards radiate outward from the mage in a starburst pattern.
 */

import Phaser from "phaser";
import { useGameStore } from "../../../features/game/gameStore";

const NOVA_MS = 320;

export function playFrostNova(
	scene: Phaser.Scene,
	heroSprite: Phaser.GameObjects.Sprite,
	onImpact?: () => void,
): void {
	useGameStore.getState().setActionInProgress(true);
	onImpact?.();

	// Six ice shard lines radiating outward
	for (let i = 0; i < 6; i++) {
		const angle = (i / 6) * Math.PI * 2;
		const tipX = heroSprite.x + Math.cos(angle) * 28;
		const tipY = heroSprite.y + Math.sin(angle) * 28;

		// Shard body — cyan line approximated as thin rectangle
		const shard = scene.add.rectangle(heroSprite.x, heroSprite.y, 3, 10, 0x88ddff, 0.85);
		shard.setRotation(angle + Math.PI / 2);
		shard.setDepth(25);

		scene.tweens.add({
			targets: shard,
			x: tipX,
			y: tipY,
			scaleX: 0.5,
			scaleY: 1.4,
			alpha: 0,
			duration: NOVA_MS,
			delay: i * 15,
			ease: "Sine.Out",
			onComplete: () => {
				// Small ice burst at tip
				const burst = scene.add.circle(tipX, tipY, 4, 0xaaeeff, 0.8);
				burst.setDepth(24);
				scene.tweens.add({
					targets: burst,
					scaleX: 2,
					scaleY: 2,
					alpha: 0,
					duration: 180,
					ease: "Sine.Out",
					onComplete: () => burst.destroy(),
				});
				shard.destroy();
				if (i === 5) useGameStore.getState().setActionInProgress(false);
			},
		});
	}

	// Light cyan inner flash
	const core = scene.add.circle(heroSprite.x, heroSprite.y, 6, 0xeeffff, 0.9);
	core.setDepth(26);
	scene.tweens.add({
		targets: core,
		scaleX: 2.5,
		scaleY: 2.5,
		alpha: 0,
		duration: NOVA_MS * 0.6,
		ease: "Sine.Out",
		onComplete: () => core.destroy(),
	});
}
