import Phaser from "phaser";
import type { GameEvent } from "@app/shared";
import { idxToXY } from "@app/shared";
import { TILE_WIDTH, TILE_HEIGHT } from "../tiles/tilesetRegistry";

const RISE_PX = 22;
const DURATION_MS = 700;
const FONT_SIZE = "11px";
const DEPTH = 30;

const COLOR_NORMAL = "#ffffff";
const COLOR_CRIT = "#ffd700";
const COLOR_MISS = "#aaaaaa";

/**
 * Spawns small floating text labels at defender positions showing damage dealt.
 * Text rises upward and fades out autonomously; each label self-destructs when done.
 */
export class DamageNumberManager {
	private scene: Phaser.Scene;
	private mapWidth: number;

	constructor(scene: Phaser.Scene, mapWidth: number) {
		this.scene = scene;
		this.mapWidth = mapWidth;
	}

	handleEvents(events: GameEvent[], getActorIdx: (id: string) => number | undefined): void {
		for (const event of events) {
			if (event.type === "attack" || event.type === "skill_hit") {
				const idx = getActorIdx(event.defenderId);
				if (idx === undefined) continue;

				const { x, y } = idxToXY(idx, this.mapWidth);
				const px = x * TILE_WIDTH + TILE_WIDTH / 2;
				const py = y * TILE_HEIGHT + TILE_HEIGHT / 2 - 8;

				if (!event.result.hit) {
					this.spawnLabel("miss", px, py, COLOR_MISS);
				} else if (event.result.critical) {
					this.spawnLabel(`${event.result.damage}!`, px, py, COLOR_CRIT);
				} else {
					this.spawnLabel(`${event.result.damage}`, px, py, COLOR_NORMAL);
				}
			} else if (event.type === "area_hit") {
				const idx = getActorIdx(event.defenderId);
				if (idx === undefined) continue;

				const { x, y } = idxToXY(idx, this.mapWidth);
				const px = x * TILE_WIDTH + TILE_WIDTH / 2;
				const py = y * TILE_HEIGHT + TILE_HEIGHT / 2 - 8;
				this.spawnLabel(`${event.damage}`, px, py, "#ff8800");
			}
		}
	}

	private spawnLabel(text: string, x: number, y: number, color: string): void {
		const label = this.scene.add.text(x, y, text, {
			fontSize: FONT_SIZE,
			color,
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
