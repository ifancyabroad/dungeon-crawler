import Phaser from "phaser";
import { useGameStore } from "../../features/game/gameStore";

export const MOVE_DURATION_MS = 80;
const DIAGONAL_MOVE_DURATION_MS = Math.round(MOVE_DURATION_MS * Math.SQRT2); // ~113ms

/**
 * Manages smooth slide tweens for entity movement.
 * Hero tweens block input via actionInProgress; NPC tweens are visual-only.
 */
export class MoveTweenManager {
	private scene: Phaser.Scene;
	private activeTweens = new Map<string, Phaser.Tweens.Tween>();

	constructor(scene: Phaser.Scene) {
		this.scene = scene;
	}

	/**
	 * Move the hero sprite to a new pixel position.
	 * When instant=true the sprite snaps immediately; actionInProgress is managed externally by
	 * the travel loop in MouseMovementController. Otherwise a tween runs and blocks input.
	 */
	moveHero(
		sprite: Phaser.GameObjects.Sprite,
		toX: number,
		toY: number,
		diagonal = false,
		instant = false,
	): void {
		this.killTween("hero");
		if (instant) {
			sprite.x = toX;
			sprite.y = toY;
			return;
		}
		useGameStore.getState().setActionInProgress(true);
		const tween = this.scene.tweens.add({
			targets: sprite,
			x: toX,
			y: toY,
			duration: diagonal ? DIAGONAL_MOVE_DURATION_MS : MOVE_DURATION_MS,
			ease: Phaser.Math.Easing.Sine.Out,
			onComplete: () => {
				this.activeTweens.delete("hero");
				useGameStore.getState().setActionInProgress(false);
			},
		});
		this.activeTweens.set("hero", tween);
	}

	/**
	 * Move an NPC sprite to a new pixel position (visual-only, no input blocking).
	 * When instant=true the sprite snaps immediately with no tween.
	 */
	moveNpc(
		id: string,
		sprite: Phaser.GameObjects.Sprite,
		toX: number,
		toY: number,
		diagonal = false,
		instant = false,
	): void {
		this.killTween(id);
		if (instant) {
			sprite.x = toX;
			sprite.y = toY;
			return;
		}
		const tween = this.scene.tweens.add({
			targets: sprite,
			x: toX,
			y: toY,
			duration: diagonal ? DIAGONAL_MOVE_DURATION_MS : MOVE_DURATION_MS,
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
