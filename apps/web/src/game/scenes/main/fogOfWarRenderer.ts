import Phaser from "phaser";
import { computeVisibility, VISION_RADIUS } from "@app/shared";
import type { FoggedSprite } from "./types";

const FOG_TINT = 0x555555;

export function applyFogState(sprite: Phaser.GameObjects.Sprite, state: number): void {
	if (state === 2) {
		sprite.setAlpha(1);
		sprite.setTint(0xffffff);
	} else if (state === 1) {
		sprite.setAlpha(1);
		sprite.setTint(FOG_TINT);
	} else {
		sprite.setAlpha(0);
	}
}

export class FogOfWarRenderer {
	private mapWidth: number;
	private mapHeight: number;
	private opacityMask: Uint8Array | null = null;
	private visibleMask: Uint8Array | null = null;
	private tileDisplayState: Uint8Array | null = null;
	private tileDisplayBuffer: Uint8Array | null = null;
	private foggedSprites: FoggedSprite[] = [];

	constructor(mapWidth: number, mapHeight: number) {
		this.mapWidth = mapWidth;
		this.mapHeight = mapHeight;
	}

	resetForMap(mapWidth: number, mapHeight: number): void {
		this.mapWidth = mapWidth;
		this.mapHeight = mapHeight;
		this.tileDisplayState = null;
		this.tileDisplayBuffer = null;
		this.visibleMask = null;
		this.opacityMask = null;
	}

	setOpacityMask(mask: Uint8Array): void {
		this.opacityMask = mask;
	}

	getVisibleMask(): Uint8Array | null {
		return this.visibleMask;
	}

	getDisplayState(): Uint8Array | null {
		return this.tileDisplayState;
	}

	registerFoggedSprite(sprite: Phaser.GameObjects.Sprite, idx: number): void {
		this.foggedSprites.push({ sprite, idx });
	}

	destroyFoggedSprites(): void {
		for (const { sprite } of this.foggedSprites) {
			sprite.destroy();
		}
		this.foggedSprites = [];
	}

	apply(
		explored: number[],
		heroX: number,
		heroY: number,
		layers: Array<Phaser.Tilemaps.TilemapLayer | null>,
	): void {
		if (!this.opacityMask) return;

		const visible = computeVisibility(
			heroX,
			heroY,
			this.mapWidth,
			this.mapHeight,
			this.opacityMask,
			VISION_RADIUS,
		);
		this.visibleMask = visible;

		const size = this.mapWidth * this.mapHeight;
		const prev = this.tileDisplayState;
		if (!this.tileDisplayBuffer || this.tileDisplayBuffer.length !== size) {
			this.tileDisplayBuffer = new Uint8Array(size);
		}
		const next = this.tileDisplayBuffer;

		for (let i = 0; i < size; i++) {
			const newState: number = visible[i] === 1 ? 2 : explored[i] === 1 ? 1 : 0;
			next[i] = newState;
			if (prev && prev[i] === newState) continue;

			const x = i % this.mapWidth;
			const y = (i / this.mapWidth) | 0;
			for (const layer of layers) {
				if (!layer) continue;
				const tile = layer.getTileAt(x, y);
				if (!tile) continue;
				if (newState === 2) {
					tile.setAlpha(1);
					tile.tint = 0xffffff;
				} else if (newState === 1) {
					tile.setAlpha(1);
					tile.tint = FOG_TINT;
				} else {
					tile.setAlpha(0);
				}
			}
		}

		this.tileDisplayState = next;
		this.tileDisplayBuffer = prev ?? new Uint8Array(size);

		for (const { sprite, idx } of this.foggedSprites) {
			applyFogState(sprite, next[idx]);
		}
	}
}
