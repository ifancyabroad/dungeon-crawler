import Phaser from "phaser";
import { idxToXY, type GameState } from "@app/shared";
import { ENTITY_TILES, TILE_HEIGHT, TILE_WIDTH, TILESET_KEY } from "../../tiles/tilesetRegistry";
import type { MoveTweenManager } from "../../fx/MoveTweenManager";
import type { HealthBarManager } from "../../fx/HealthBarManager";
import { resolveActorTint } from "../../fx/buffVisuals";
import type { ActorEffectVisualManager } from "../../fx/ActorEffectVisualManager";

export interface ActorSpriteSyncDeps {
	scene: Phaser.Scene;
	mapWidth: number;
	visibleMask: Uint8Array | null;
	player: Phaser.GameObjects.Sprite | null;
	moveTweens: MoveTweenManager | null;
	healthBars: HealthBarManager | null;
	actorEffectVisuals: ActorEffectVisualManager | null;
}

export class ActorSpriteSync {
	private npcSprites = new Map<string, Phaser.GameObjects.Sprite>();

	getNpcSprites(): Map<string, Phaser.GameObjects.Sprite> {
		return this.npcSprites;
	}

	clearAndDestroy(): void {
		for (const sprite of this.npcSprites.values()) {
			sprite.destroy();
		}
		this.npcSprites.clear();
	}

	sync(gameState: GameState, deps: ActorSpriteSyncDeps): void {
		const floor = gameState.floors[gameState.heroFloorIndex];
		if (!floor) return;
		const actorsById = floor.state.actorsById;

		for (const [id, actor] of Object.entries(actorsById)) {
			if (id === gameState.heroId) continue;
			if (actor.def.type !== "npc") continue;

			const existing = this.npcSprites.get(id);
			if (!actor.alive) {
				if (existing) {
					existing.destroy();
					this.npcSprites.delete(id);
					deps.healthBars?.remove(id);
				}
				continue;
			}

			const { x, y } = idxToXY(actor.idx, deps.mapWidth);
			const px = x * TILE_WIDTH + TILE_WIDTH / 2;
			const py = y * TILE_HEIGHT + TILE_HEIGHT / 2;
			const tileFrame = ENTITY_TILES.npcs[actor.def.npcId];
			if (tileFrame === undefined) continue;

			const isVisible = deps.visibleMask?.[actor.idx] === 1;

			if (existing) {
				const prevTileX = Math.round((existing.x - TILE_WIDTH / 2) / TILE_WIDTH);
				const prevTileY = Math.round((existing.y - TILE_HEIGHT / 2) / TILE_HEIGHT);
				const diagonal = prevTileX !== x && prevTileY !== y;
				deps.moveTweens?.moveNpc(id, existing, px, py, diagonal);
				existing.setFrame(tileFrame);
				existing.setVisible(isVisible);
				if (isVisible) {
					deps.healthBars?.update(id, actor.hp, actor.maxHp, existing);
				}
			} else {
				const sprite = deps.scene.add.sprite(px, py, TILESET_KEY, tileFrame);
				sprite.setOrigin(0.5, 0.5);
				sprite.setDepth(9);
				sprite.setVisible(isVisible);
				this.npcSprites.set(id, sprite);
				if (isVisible) {
					deps.healthBars?.update(id, actor.hp, actor.maxHp, sprite);
				}
			}
		}

		for (const [id, sprite] of this.npcSprites) {
			if (!actorsById[id]) {
				sprite.destroy();
				this.npcSprites.delete(id);
				deps.healthBars?.remove(id);
			}
		}

		const hero = actorsById[gameState.heroId];
		if (hero && deps.player) {
			const shieldHp = hero.numericBuffs?.shieldHp ?? 0;
			deps.healthBars?.update(gameState.heroId, hero.hp, hero.maxHp, deps.player, shieldHp);
			deps.player.setTint(resolveActorTint(hero));
			deps.actorEffectVisuals?.sync(hero, deps.player);
		}
	}
}
