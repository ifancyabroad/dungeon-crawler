/**
 * Gore visual effect: a savage lunge toward the target with a bloody piercing impact.
 */

import Phaser from "phaser";
import { useGameStore } from "../../../features/game/gameStore";

const GORE_MS = 160;

export function playGore(
	scene: Phaser.Scene,
	casterSprite: Phaser.GameObjects.Sprite,
	targetPx: number,
	targetPy: number,
	onImpact?: () => void,
): void {
	useGameStore.getState().setActionInProgress(true);

	const dx = targetPx - casterSprite.x;
	const dy = targetPy - casterSprite.y;
	const len = Math.sqrt(dx * dx + dy * dy) || 1;
	const ndx = dx / len;
	const ndy = dy / len;

	const origX = casterSprite.x;
	const origY = casterSprite.y;

	scene.tweens.add({
		targets: casterSprite,
		x: casterSprite.x + ndx * 12,
		y: casterSprite.y + ndy * 12,
		duration: GORE_MS / 2,
		ease: "Sine.In",
		onComplete: () => {
			onImpact?.();

			// Dark red impact burst — piercing wound
			const burst = scene.add.circle(targetPx, targetPy, 7, 0xcc0011, 0.9);
			burst.setDepth(26);
			scene.tweens.add({
				targets: burst,
				scaleX: 3,
				scaleY: 3,
				alpha: 0,
				duration: 280,
				ease: "Sine.Out",
				onComplete: () => burst.destroy(),
			});

			// Blood droplets spraying outward
			for (let i = 0; i < 5; i++) {
				const angle = Math.atan2(ndy, ndx) + (Math.random() - 0.5) * Math.PI;
				const dist = 10 + Math.random() * 12;
				const drop = scene.add.circle(targetPx, targetPy, 2, 0x990000, 0.9);
				drop.setDepth(25);
				scene.tweens.add({
					targets: drop,
					x: targetPx + Math.cos(angle) * dist,
					y: targetPy + Math.sin(angle) * dist,
					alpha: 0,
					duration: 300,
					delay: i * 30,
					ease: "Quad.Out",
					onComplete: () => drop.destroy(),
				});
			}

			// Retract caster
			scene.tweens.add({
				targets: casterSprite,
				x: origX,
				y: origY,
				duration: GORE_MS / 2,
				ease: "Sine.Out",
				onComplete: () => {
					useGameStore.getState().setActionInProgress(false);
				},
			});
		},
	});
}
