import Phaser from "phaser";
import type { GameEvent } from "@app/shared";
import { useGameStore } from "../../features/game/gameStore";
import { TILE_WIDTH, TILE_HEIGHT } from "../tiles/tilesetRegistry";
import { idxToXY } from "@app/shared";

const BUMP_DISTANCE = 8;
const BUMP_DURATION_MS = 60;
const FLASH_DURATION_MS = 80;

/**
 * Animates melee attacks: bumps attacker toward defender and returns.
 * Hero attacks block input via actionInProgress until the animation completes.
 */
export class AttackAnimator {
	private scene: Phaser.Scene;
	private mapWidth: number;

	constructor(scene: Phaser.Scene, mapWidth: number) {
		this.scene = scene;
		this.mapWidth = mapWidth;
	}

	playEvents(
		events: GameEvent[],
		heroId: string,
		heroSprite: Phaser.GameObjects.Sprite,
		monsterSprites: Map<string, Phaser.GameObjects.Sprite>,
		getActorIdx: (id: string) => number | undefined,
	): void {
		const animatable = events.filter(
			(e): e is Extract<GameEvent, { type: "attack" }> => e.type === "attack",
		);
		if (animatable.length === 0) return;

		const isHeroAttacking = animatable.some((e) => e.attackerId === heroId);
		if (isHeroAttacking) {
			useGameStore.getState().setActionInProgress(true);
		}

		let completed = 0;
		const onDone = () => {
			completed++;
			if (completed >= animatable.length && isHeroAttacking) {
				useGameStore.getState().setActionInProgress(false);
			}
		};

		for (const event of animatable) {
			const attackerSprite =
				event.attackerId === heroId
					? heroSprite
					: (monsterSprites.get(event.attackerId) ?? null);
			const defenderIdx = getActorIdx(event.defenderId);

			if (!attackerSprite || defenderIdx === undefined) {
				onDone();
				continue;
			}

			const defPos = idxToXY(defenderIdx, this.mapWidth);
			const defPx = defPos.x * TILE_WIDTH + TILE_WIDTH / 2;
			const defPy = defPos.y * TILE_HEIGHT + TILE_HEIGHT / 2;

			const dx = defPx - attackerSprite.x;
			const dy = defPy - attackerSprite.y;
			const len = Math.sqrt(dx * dx + dy * dy) || 1;
			const bumpX = attackerSprite.x + (dx / len) * BUMP_DISTANCE;
			const bumpY = attackerSprite.y + (dy / len) * BUMP_DISTANCE;
			const bumpOffsetX = (dx / len) * BUMP_DISTANCE;
			const bumpOffsetY = (dy / len) * BUMP_DISTANCE;

			// On a miss, flash the defender to indicate the attack failed.
			const defenderSprite =
				event.defenderId === heroId
					? heroSprite
					: (monsterSprites.get(event.defenderId) ?? null);

			this.scene.tweens.chain({
				targets: attackerSprite,
				tweens: [
					{ x: bumpX, y: bumpY, duration: BUMP_DURATION_MS, ease: "Sine.Out" },
					// Return uses relative offset so the sprite lands back at its resting
					// position regardless of any concurrent move tween.
					{
						x: `-=${bumpOffsetX}`,
						y: `-=${bumpOffsetY}`,
						duration: BUMP_DURATION_MS,
						ease: "Sine.In",
					},
				],
				onComplete: () => {
					if (!event.result.hit && defenderSprite) {
						this.flashSprite(defenderSprite);
					}
					onDone();
				},
			});
		}
	}

	private flashSprite(sprite: Phaser.GameObjects.Sprite): void {
		sprite.setTint(0xff4444);
		this.scene.time.delayedCall(FLASH_DURATION_MS, () => {
			if (sprite.active) sprite.clearTint();
		});
	}

	destroy(): void {
		useGameStore.getState().setActionInProgress(false);
	}
}
