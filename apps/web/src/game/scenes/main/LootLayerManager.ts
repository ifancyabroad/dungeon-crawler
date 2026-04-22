import Phaser from "phaser";
import { idxToXY } from "@app/shared";
import type { LootDrop } from "@app/shared";
import { TILESET_KEY, TILE_WIDTH, TILE_HEIGHT } from "../../tiles/tilesetRegistry";
import { applyFogState, type FogOfWarRenderer } from "./fogOfWarRenderer";

/** Tile ids used for loot piles on the ground layer. */
const TILE_GOLD_ONLY = 825;
const TILE_ITEM_PILE = 827;

/**
 * Manages loot pile sprites on the current floor.
 * Fog state is applied directly from fogRenderer.getDisplayState() on each sync,
 * matching the pull model used by ActorSpriteSync for NPCs.
 * Chest loot is never stored in lootByIdx, so no filtering is required here.
 */
export class LootLayerManager {
	private sprites = new Map<number, Phaser.GameObjects.Sprite>();
	private scene: Phaser.Scene;
	private mapWidth: number;
	private fogRenderer: FogOfWarRenderer;

	constructor(scene: Phaser.Scene, mapWidth: number, fogRenderer: FogOfWarRenderer) {
		this.scene = scene;
		this.mapWidth = mapWidth;
		this.fogRenderer = fogRenderer;
	}

	sync(lootByIdx: Record<string, LootDrop>): void {
		const displayState = this.fogRenderer.getDisplayState();
		const activeIdxs = new Set(Object.keys(lootByIdx).map(Number));

		// Remove sprites for tiles no longer in lootByIdx.
		for (const [idx, sprite] of this.sprites) {
			if (!activeIdxs.has(idx)) {
				sprite.destroy();
				this.sprites.delete(idx);
			}
		}

		// Create or update sprites for active loot tiles.
		for (const idx of activeIdxs) {
			const state = displayState?.[idx] ?? 0;
			const existing = this.sprites.get(idx);
			if (existing) {
				applyFogState(existing, state);
			} else {
				const loot = lootByIdx[String(idx)]!;
				const { x, y } = idxToXY(idx, this.mapWidth);
				const px = x * TILE_WIDTH + TILE_WIDTH / 2;
				const py = y * TILE_HEIGHT + TILE_HEIGHT / 2;
				const tileId = loot.items.length > 0 ? TILE_ITEM_PILE : TILE_GOLD_ONLY;
				const sprite = this.scene.add.sprite(px, py, TILESET_KEY, tileId);
				sprite.setDepth(2);
				applyFogState(sprite, state);
				this.sprites.set(idx, sprite);
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
