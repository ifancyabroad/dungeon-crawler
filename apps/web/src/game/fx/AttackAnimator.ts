import Phaser from "phaser";
import type { GameEvent } from "@app/shared";
import { useGameStore } from "../../features/game/gameStore";
import { TILE_WIDTH, TILE_HEIGHT } from "../tiles/tilesetRegistry";
import { idxToXY } from "@app/shared";
import { ensureBloodTexture, BLOOD_TEXTURE_KEY, bloodTintsFromColor } from "./particles";

const BUMP_DISTANCE = 8;
const BUMP_DURATION_MS = 60;

const SQUIRT_COUNT = 4;
const SQUIRT_SPEED_MIN = 25;
const SQUIRT_SPEED_MAX = 55;
const SQUIRT_LIFESPAN_MS = 220;
const SQUIRT_DEPTH = 15;

/**
 * Animates melee attacks: bumps attacker toward defender and returns.
 * On a hit, a small blood squirt fires from the defender's position.
 * Misses show no blood — the absence of particles communicates the miss clearly.
 * Hero attacks block input via actionInProgress until the animation completes.
 */
export class AttackAnimator {
	private scene: Phaser.Scene;
	private mapWidth: number;

	constructor(scene: Phaser.Scene, mapWidth: number) {
		this.scene = scene;
		this.mapWidth = mapWidth;
		ensureBloodTexture(scene);
	}

	playEvents(
		events: GameEvent[],
		heroId: string,
		heroSprite: Phaser.GameObjects.Sprite,
		monsterSprites: Map<string, Phaser.GameObjects.Sprite>,
		getActorIdx: (id: string) => number | undefined,
		getBloodColor: (actorId: string) => string,
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
			const bumpOffsetX = (dx / len) * BUMP_DISTANCE;
			const bumpOffsetY = (dy / len) * BUMP_DISTANCE;

			this.scene.tweens.chain({
				targets: attackerSprite,
				tweens: [
					{
						x: attackerSprite.x + bumpOffsetX,
						y: attackerSprite.y + bumpOffsetY,
						duration: BUMP_DURATION_MS,
						ease: "Sine.Out",
					},
					// Return via relative offset so it lands back at the resting position
					// regardless of any concurrent move tween.
					{
						x: `-=${bumpOffsetX}`,
						y: `-=${bumpOffsetY}`,
						duration: BUMP_DURATION_MS,
						ease: "Sine.In",
					},
				],
				onComplete: () => {
					if (event.result.hit) {
						this.squirt(
							defPx,
							defPy,
							dx / len,
							dy / len,
							getBloodColor(event.defenderId),
						);
					}
					onDone();
				},
			});
		}
	}

	/**
	 * Fire a small directional blood squirt from the defender's position.
	 * The spread is biased toward the direction the hit came from.
	 */
	private squirt(
		x: number,
		y: number,
		hitDirX: number,
		hitDirY: number,
		bloodColor: string,
	): void {
		// Angle of impact direction in degrees, spread ±60° around it
		const baseAngle = (Math.atan2(hitDirY, hitDirX) * 180) / Math.PI;

		const emitter = this.scene.add.particles(x, y, BLOOD_TEXTURE_KEY, {
			speed: { min: SQUIRT_SPEED_MIN, max: SQUIRT_SPEED_MAX },
			angle: { min: baseAngle - 60, max: baseAngle + 60 },
			lifespan: SQUIRT_LIFESPAN_MS,
			quantity: SQUIRT_COUNT,
			emitting: false,
			gravityY: 80,
			scale: { start: 0.9, end: 0.2 },
			alpha: { start: 0.9, end: 0 },
			tint: bloodTintsFromColor(bloodColor),
		});

		emitter.setDepth(SQUIRT_DEPTH);
		emitter.explode(SQUIRT_COUNT, 0, 0);

		this.scene.time.delayedCall(SQUIRT_LIFESPAN_MS + 50, () => {
			if (emitter.active) emitter.destroy();
		});
	}

	destroy(): void {
		useGameStore.getState().setActionInProgress(false);
	}
}
