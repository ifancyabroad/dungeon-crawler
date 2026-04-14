import Phaser from "phaser";
import { idxToXY, type ChestType } from "@app/shared";
import { TILESET_KEY, TILE_WIDTH, TILE_HEIGHT, ENTITY_TILES } from "../../tiles/tilesetRegistry";
import type { FogOfWarRenderer } from "./fogOfWarRenderer";

function tileIdForChest(chestType: ChestType, open: boolean): number {
	return open
		? ENTITY_TILES.chests[`${chestType}_open`]
		: ENTITY_TILES.chests[`${chestType}_closed`];
}

/**
 * Manages chest sprites for the current floor.
 * Reads semantic state (chestsByIdx for closed, openedChestsByIdx for opened)
 * and derives tile IDs via ENTITY_TILES.chests — the engine never needs to know tile IDs.
 */
export class ChestLayerManager {
	private sprites = new Map<number, Phaser.GameObjects.Sprite>();
	private scene: Phaser.Scene;
	private mapWidth: number;
	private fogRenderer: FogOfWarRenderer;

	constructor(scene: Phaser.Scene, mapWidth: number, fogRenderer: FogOfWarRenderer) {
		this.scene = scene;
		this.mapWidth = mapWidth;
		this.fogRenderer = fogRenderer;
	}

	sync(
		chestsByIdx: Record<string, ChestType>,
		openedChestsByIdx: Record<string, ChestType>,
	): void {
		// Build a complete map of idx → tileId from both semantic sources.
		const current = new Map<number, number>();
		for (const [key, chestType] of Object.entries(chestsByIdx)) {
			current.set(Number(key), tileIdForChest(chestType, false));
		}
		for (const [key, chestType] of Object.entries(openedChestsByIdx)) {
			current.set(Number(key), tileIdForChest(chestType, true));
		}

		// Remove sprites for chests no longer present.
		for (const [idx, sprite] of this.sprites) {
			if (!current.has(idx)) {
				sprite.destroy();
				this.sprites.delete(idx);
			}
		}

		// Create or update sprites for current chests.
		for (const [idx, tileId] of current) {
			const existing = this.sprites.get(idx);
			if (existing) {
				// Update frame if the chest transitioned from closed to open.
				if (existing.frame.name !== String(tileId)) {
					existing.setFrame(tileId);
				}
			} else {
				const { x, y } = idxToXY(idx, this.mapWidth);
				const px = x * TILE_WIDTH + TILE_WIDTH / 2;
				const py = y * TILE_HEIGHT + TILE_HEIGHT / 2;
				const sprite = this.scene.add.sprite(px, py, TILESET_KEY, tileId);
				sprite.setDepth(2);
				this.sprites.set(idx, sprite);
				this.fogRenderer.registerFoggedSprite(sprite, idx);
			}
		}
	}

	destroyAll(): void {
		for (const sprite of this.sprites.values()) {
			sprite.destroy();
		}
		this.sprites.clear();
	}
}
