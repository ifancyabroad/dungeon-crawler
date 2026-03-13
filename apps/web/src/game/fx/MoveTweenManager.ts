import Phaser from "phaser";
import { useGameStore } from "../../features/game/gameStore";

export const MOVE_DURATION_MS = 80;

/**
 * Manages smooth slide tweens for entity movement.
 * Hero tweens block input via actionInProgress; monster tweens are visual-only.
 */
export class MoveTweenManager {
	private scene: Phaser.Scene;
	private activeTweens = new Map<string, Phaser.Tweens.Tween>();

	constructor(scene: Phaser.Scene) {
		this.scene = scene;
	}

	/**
	 * Tween the hero sprite to a new pixel position and block input until complete.
	 */
	moveHero(sprite: Phaser.GameObjects.Sprite, toX: number, toY: number): void {
		this.killTween("hero");
		useGameStore.getState().setActionInProgress(true);
		const tween = this.scene.tweens.add({
			targets: sprite,
			x: toX,
			y: toY,
			duration: MOVE_DURATION_MS,
			ease: Phaser.Math.Easing.Sine.Out,
			onComplete: () => {
				this.activeTweens.delete("hero");
				useGameStore.getState().setActionInProgress(false);
			},
		});
		this.activeTweens.set("hero", tween);
	}

	/**
	 * Tween a monster sprite to a new pixel position (visual-only, no input blocking).
	 */
	moveMonster(id: string, sprite: Phaser.GameObjects.Sprite, toX: number, toY: number): void {
		this.killTween(id);
		const tween = this.scene.tweens.add({
			targets: sprite,
			x: toX,
			y: toY,
			duration: MOVE_DURATION_MS,
			ease: Phaser.Math.Easing.Sine.Out,
			onComplete: () => {
				this.activeTweens.delete(id);
			},
		});
		this.activeTweens.set(id, tween);
	}

	private killTween(id: string): void {
		const tween = this.activeTweens.get(id);
		if (tween) {
			tween.stop();
			this.activeTweens.delete(id);
		}
	}

	destroy(): void {
		for (const tween of this.activeTweens.values()) {
			tween.stop();
		}
		this.activeTweens.clear();
		useGameStore.getState().setActionInProgress(false);
	}
}
