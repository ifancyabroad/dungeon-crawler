import Phaser from "phaser";
import { idxToXY, type ChestState, type ChestType } from "@app/shared";
import { TILESET_KEY, TILE_WIDTH, TILE_HEIGHT, ENTITY_TILES } from "../../tiles/tilesetRegistry";
import { applyFogState, type FogOfWarRenderer } from "./fogOfWarRenderer";

function tileIdForChest(chestType: ChestType, open: boolean): number {
	return open
		? ENTITY_TILES.chests[`${chestType}_open`]
		: ENTITY_TILES.chests[`${chestType}_closed`];
}

/**
 * Manages chest sprites for the current floor.
 * Reads the unified chestsByIdx map and derives closed/open tile IDs from chest.opened.
 * Fog state is applied directly from fogRenderer.getDisplayState() on each sync,
 * matching the pull model used by ActorSpriteSync for NPCs.
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

	sync(chestsByIdx: Record<string, ChestState>): void {
		const displayState = this.fogRenderer.getDisplayState();

		// Build a complete map of idx → tileId from the unified chest state.
		const current = new Map<number, number>();
		for (const [key, chest] of Object.entries(chestsByIdx)) {
			current.set(Number(key), tileIdForChest(chest.rarity, chest.opened));
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
			const state = displayState?.[idx] ?? 0;
			const existing = this.sprites.get(idx);
			if (existing) {
				if (existing.frame.name !== String(tileId)) {
					existing.setFrame(tileId);
				}
				applyFogState(existing, state);
			} else {
				const { x, y } = idxToXY(idx, this.mapWidth);
				const px = x * TILE_WIDTH + TILE_WIDTH / 2;
				const py = y * TILE_HEIGHT + TILE_HEIGHT / 2;
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
