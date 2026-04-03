import Phaser from "phaser";
import { idxToXY } from "@app/shared";
import type { GameEvent } from "@app/shared";
import { TILE_WIDTH, TILE_HEIGHT } from "../tiles/tilesetRegistry";

const RISE_PX = 30;
const DURATION_MS = 900;
const DEPTH = 20;
const COLOR = "#f5c542";

/**
 * Spawns floating "+N gold" text when a gold_collected event fires.
 * Text rises upward and fades, then self-destructs.
 */
export class GoldFxManager {
	private scene: Phaser.Scene;
	private mapWidth: number;

	constructor(scene: Phaser.Scene, mapWidth: number) {
		this.scene = scene;
		this.mapWidth = mapWidth;
	}

	handleEvents(events: GameEvent[]): void {
		for (const event of events) {
			if (event.type === "gold_collected") {
				const { x, y } = idxToXY(event.tileIdx, this.mapWidth);
				const px = x * TILE_WIDTH + TILE_WIDTH / 2;
				const py = y * TILE_HEIGHT + TILE_HEIGHT / 2 - 8;
				this.spawnLabel(`+${event.amount} gold`, px, py);
			}
		}
	}

	private spawnLabel(text: string, x: number, y: number): void {
		const label = this.scene.add.text(x, y, text, {
			fontSize: "11px",
			color: COLOR,
			stroke: "#000000",
			strokeThickness: 2,
			fontStyle: "bold",
		});
		label.setOrigin(0.5, 1);
		label.setDepth(DEPTH);

		this.scene.tweens.add({
			targets: label,
			y: y - RISE_PX,
			alpha: 0,
			duration: DURATION_MS,
			ease: "Sine.Out",
			onComplete: () => label.destroy(),
		});
	}
}
