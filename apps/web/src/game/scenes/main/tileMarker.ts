/**
 * TileMarker — renders DCSS-style corner brackets on the hovered tile.
 *
 * Visual states:
 *   valid   — white corners (explored/visible + walkable)
 *   invalid — dark-red corners (explored/visible + not walkable)
 *   hidden  — nothing rendered (unexplored)
 */

import Phaser from "phaser";
import { TILE_WIDTH, TILE_HEIGHT } from "../../tiles/tilesetRegistry";

const ARM = 7; // length of each bracket arm in pixels
const THICKNESS = 2;
const COLOR_VALID = 0xffffff;
const COLOR_INVALID = 0x882222;

/** Depth above hero (10) and NPCs (9). */
const MARKER_DEPTH = 20;

export type TileMarkerState = "valid" | "invalid" | "hidden";

export class TileMarker {
	private graphics: Phaser.GameObjects.Graphics;
	private currentState: TileMarkerState = "hidden";
	private currentTileX = -1;
	private currentTileY = -1;

	constructor(scene: Phaser.Scene) {
		this.graphics = scene.add.graphics();
		this.graphics.setDepth(MARKER_DEPTH);
	}

	setTile(tileX: number, tileY: number, state: TileMarkerState): void {
		if (
			state === this.currentState &&
			tileX === this.currentTileX &&
			tileY === this.currentTileY
		) {
			return;
		}
		this.currentState = state;
		this.currentTileX = tileX;
		this.currentTileY = tileY;
		this.redraw();
	}

	clear(): void {
		this.currentState = "hidden";
		this.currentTileX = -1;
		this.currentTileY = -1;
		this.graphics.clear();
	}

	destroy(): void {
		this.graphics.destroy();
	}

	private redraw(): void {
		this.graphics.clear();
		if (this.currentState === "hidden") return;

		const color = this.currentState === "valid" ? COLOR_VALID : COLOR_INVALID;
		this.graphics.lineStyle(THICKNESS, color, 1);

		const px = this.currentTileX * TILE_WIDTH;
		const py = this.currentTileY * TILE_HEIGHT;
		const w = TILE_WIDTH;
		const h = TILE_HEIGHT;

		// Top-left corner
		this.graphics.strokePoints(
			[
				{ x: px, y: py + ARM },
				{ x: px, y: py },
				{ x: px + ARM, y: py },
			],
			false,
		);
		// Top-right corner
		this.graphics.strokePoints(
			[
				{ x: px + w - ARM, y: py },
				{ x: px + w, y: py },
				{ x: px + w, y: py + ARM },
			],
			false,
		);
		// Bottom-left corner
		this.graphics.strokePoints(
			[
				{ x: px, y: py + h - ARM },
				{ x: px, y: py + h },
				{ x: px + ARM, y: py + h },
			],
			false,
		);
		// Bottom-right corner
		this.graphics.strokePoints(
			[
				{ x: px + w - ARM, y: py + h },
				{ x: px + w, y: py + h },
				{ x: px + w, y: py + h - ARM },
			],
			false,
		);
	}
}
