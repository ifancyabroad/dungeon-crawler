import Phaser from "phaser";
import type { GameEvent } from "@app/shared";
import { idxToXY } from "@app/shared";
import { TILE_WIDTH, TILE_HEIGHT } from "../tiles/tilesetRegistry";

const STAIN_RADIUS = 7;
const STAIN_COLOR = 0x6b0000;
const STAIN_ALPHA = 0.55;
const DEPTH = 2; // above ground tiles, below decoration

/**
 * Draws a persistent blood stain graphic at the tile where a monster died.
 * Stains survive until the map is rebuilt (floor change or new game).
 */
export class DeathStainManager {
	private scene: Phaser.Scene;
	private mapWidth: number;
	private stains: Phaser.GameObjects.Graphics[] = [];

	constructor(scene: Phaser.Scene, mapWidth: number) {
		this.scene = scene;
		this.mapWidth = mapWidth;
	}

	handleEvents(
		events: GameEvent[],
		heroId: string,
		getActorIdx: (id: string) => number | undefined,
	): void {
		for (const event of events) {
			if (event.type !== "death" || event.actorId === heroId) continue;
			const idx = getActorIdx(event.actorId);
			if (idx !== undefined) this.drawStain(idx);
		}
	}

	destroy(): void {
		for (const g of this.stains) g.destroy();
		this.stains = [];
	}

	private drawStain(idx: number): void {
		const { x, y } = idxToXY(idx, this.mapWidth);
		const cx = x * TILE_WIDTH + TILE_WIDTH / 2;
		const cy = y * TILE_HEIGHT + TILE_HEIGHT / 2 + 4;

		const g = this.scene.add.graphics();
		g.setDepth(DEPTH);
		g.fillStyle(STAIN_COLOR, STAIN_ALPHA);
		g.fillEllipse(cx, cy, STAIN_RADIUS * 2, STAIN_RADIUS * 1.3);
		g.fillStyle(0x8b0000, STAIN_ALPHA * 0.5);
		g.fillEllipse(cx - 1, cy - 1, STAIN_RADIUS * 0.8, STAIN_RADIUS * 0.6);

		this.stains.push(g);
	}
}
