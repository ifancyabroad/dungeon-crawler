import Phaser from "phaser";
import type { GameEvent } from "@app/shared";
import { idxToXY } from "@app/shared";
import { TILE_WIDTH, TILE_HEIGHT } from "../tiles/tilesetRegistry";
import { ensureBloodTexture, BLOOD_TEXTURE_KEY, bloodTintsFromColor } from "./particles";

const PARTICLE_COUNT = 8;
const SPEED_MIN = 40;
const SPEED_MAX = 100;
const LIFESPAN_MS = 380;
const DEPTH = 15;

/**
 * Plays a one-shot blood-burst particle effect at the tile where a monster dies.
 * Particle colour is driven by the dying actor's bloodColor via getBloodColor.
 * Emitters self-destruct after the burst completes — no manual cleanup required.
 */
export class DeathFxManager {
	private scene: Phaser.Scene;
	private mapWidth: number;

	constructor(scene: Phaser.Scene, mapWidth: number) {
		this.scene = scene;
		this.mapWidth = mapWidth;
		ensureBloodTexture(scene);
	}

	handleEvents(
		events: GameEvent[],
		heroId: string,
		getActorIdx: (id: string) => number | undefined,
		getBloodColor: (actorId: string) => string,
	): void {
		for (const event of events) {
			if (event.type !== "death" || event.actorId === heroId) continue;
			const idx = getActorIdx(event.actorId);
			if (idx !== undefined) this.burst(idx, getBloodColor(event.actorId));
		}
	}

	private burst(idx: number, bloodColor: string): void {
		const { x, y } = idxToXY(idx, this.mapWidth);
		const cx = x * TILE_WIDTH + TILE_WIDTH / 2;
		const cy = y * TILE_HEIGHT + TILE_HEIGHT / 2;

		const emitter = this.scene.add.particles(cx, cy, BLOOD_TEXTURE_KEY, {
			speed: { min: SPEED_MIN, max: SPEED_MAX },
			angle: { min: 0, max: 360 },
			lifespan: LIFESPAN_MS,
			quantity: PARTICLE_COUNT,
			emitting: false,
			gravityY: 60,
			scale: { start: 1.2, end: 0.3 },
			alpha: { start: 1, end: 0 },
			tint: bloodTintsFromColor(bloodColor),
		});

		emitter.setDepth(DEPTH);
		emitter.explode(PARTICLE_COUNT, 0, 0);

		this.scene.time.delayedCall(LIFESPAN_MS + 50, () => {
			if (emitter.active) emitter.destroy();
		});
	}
}
