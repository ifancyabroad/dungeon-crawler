import Phaser from "phaser";
import { idxToXY, type Actor, type GameState } from "@app/shared";
import { ENTITY_TILES, TILE_HEIGHT, TILE_WIDTH, TILESET_KEY } from "../../tiles/tilesetRegistry";
import type { MoveTweenManager } from "../../fx/MoveTweenManager";
import type { HealthBarManager } from "../../fx/HealthBarManager";
import {
	resolveActorTint,
	resolveActorAlpha,
	ALL_ACTOR_OVERLAY_EFFECTS,
} from "../../fx/actorOverlays";
import type {
	ActorEffectVisualManager,
	ActorOverlayHandle,
} from "../../fx/ActorEffectVisualManager";

export interface ActorSpriteSyncDeps {
	scene: Phaser.Scene;
	mapWidth: number;
	visibleMask: Uint8Array | null;
	player: Phaser.GameObjects.Sprite | null;
	moveTweens: MoveTweenManager | null;
	healthBars: HealthBarManager | null;
	actorEffectVisuals: ActorEffectVisualManager | null;
	instantTravel?: boolean;
}

export class ActorSpriteSync {
	private npcSprites = new Map<string, Phaser.GameObjects.Sprite>();
	private npcEffectHandles = new Map<string, Map<string, ActorOverlayHandle>>();
	private scene: Phaser.Scene | null = null;
	private onUpdateBound: (() => void) | null = null;

	getNpcSprites(): Map<string, Phaser.GameObjects.Sprite> {
		return this.npcSprites;
	}

	private setupUpdateListener(scene: Phaser.Scene): void {
		if (this.scene === scene) return;
		if (this.scene && this.onUpdateBound) {
			this.scene.events.off("update", this.onUpdateBound);
		}
		this.scene = scene;
		this.onUpdateBound = () => {
			for (const [actorId, handles] of this.npcEffectHandles) {
				const sprite = this.npcSprites.get(actorId);
				if (!sprite) continue;
				for (const handle of handles.values()) {
					handle.reposition(sprite.x, sprite.y);
				}
			}
		};
		scene.events.on("update", this.onUpdateBound);
	}

	clearAndDestroy(): void {
		if (this.scene && this.onUpdateBound) {
			this.scene.events.off("update", this.onUpdateBound);
			this.scene = null;
			this.onUpdateBound = null;
		}
		for (const sprite of this.npcSprites.values()) {
			sprite.destroy();
		}
		this.npcSprites.clear();
		this.destroyAllNpcEffects();
	}

	private destroyAllNpcEffects(): void {
		for (const handles of this.npcEffectHandles.values()) {
			for (const handle of handles.values()) {
				handle.destroy();
			}
		}
		this.npcEffectHandles.clear();
	}

	private destroyNpcEffects(actorId: string): void {
		const handles = this.npcEffectHandles.get(actorId);
		if (!handles) return;
		for (const handle of handles.values()) {
			handle.destroy();
		}
		this.npcEffectHandles.delete(actorId);
	}

	private syncNpcEffects(
		actorId: string,
		actor: Actor,
		sprite: Phaser.GameObjects.Sprite,
		scene: Phaser.Scene,
	): void {
		if (!this.npcEffectHandles.has(actorId)) {
			this.npcEffectHandles.set(actorId, new Map());
		}
		const handles = this.npcEffectHandles.get(actorId)!;

		for (const effect of ALL_ACTOR_OVERLAY_EFFECTS) {
			const shouldBeActive = effect.isActive(actor) && sprite.visible;
			const isCurrentlyActive = handles.has(effect.id);

			if (shouldBeActive && !isCurrentlyActive) {
				const handle = effect.build(scene);
				handle.reposition(sprite.x, sprite.y);
				handles.set(effect.id, handle);
			} else if (!shouldBeActive && isCurrentlyActive) {
				handles.get(effect.id)!.destroy();
				handles.delete(effect.id);
			}
		}
	}

	sync(gameState: GameState, deps: ActorSpriteSyncDeps): void {
		this.setupUpdateListener(deps.scene);
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
					this.destroyNpcEffects(id);
				}
				continue;
			}

			const { x, y } = idxToXY(actor.idx, deps.mapWidth);
			const px = x * TILE_WIDTH + TILE_WIDTH / 2;
			const py = y * TILE_HEIGHT + TILE_HEIGHT / 2;
			const tileFrame = ENTITY_TILES.npcs[actor.def.npcId];
			if (tileFrame === undefined) continue;

			const isVisible = deps.visibleMask?.[actor.idx] === 1;

			let npcSprite: Phaser.GameObjects.Sprite;
			if (existing) {
				const prevTileX = Math.round((existing.x - TILE_WIDTH / 2) / TILE_WIDTH);
				const prevTileY = Math.round((existing.y - TILE_HEIGHT / 2) / TILE_HEIGHT);
				const diagonal = prevTileX !== x && prevTileY !== y;
				deps.moveTweens?.moveNpc(id, existing, px, py, diagonal, deps.instantTravel);
				existing.setFrame(tileFrame);
				existing.setVisible(isVisible);
				existing.setTint(resolveActorTint(actor));
				existing.setAlpha(resolveActorAlpha(actor));
				if (isVisible) {
					deps.healthBars?.update(id, actor.hp, actor.maxHp, existing);
				}
				npcSprite = existing;
			} else {
				npcSprite = deps.scene.add.sprite(px, py, TILESET_KEY, tileFrame);
				npcSprite.setOrigin(0.5, 0.5);
				npcSprite.setDepth(9);
				npcSprite.setVisible(isVisible);
				npcSprite.setTint(resolveActorTint(actor));
				npcSprite.setAlpha(resolveActorAlpha(actor));
				this.npcSprites.set(id, npcSprite);
				if (isVisible) {
					deps.healthBars?.update(id, actor.hp, actor.maxHp, npcSprite);
				}
			}

			this.syncNpcEffects(id, actor, npcSprite, deps.scene);
		}

		for (const [id, sprite] of this.npcSprites) {
			if (!actorsById[id]) {
				sprite.destroy();
				this.npcSprites.delete(id);
				deps.healthBars?.remove(id);
				this.destroyNpcEffects(id);
			}
		}

		const hero = actorsById[gameState.heroId];
		if (hero && deps.player) {
			const shieldHp = hero.numericBuffs?.shieldHp ?? 0;
			deps.healthBars?.update(gameState.heroId, hero.hp, hero.maxHp, deps.player, shieldHp);
			deps.player.setTint(resolveActorTint(hero));
			deps.player.setAlpha(resolveActorAlpha(hero));
			deps.actorEffectVisuals?.sync(hero, deps.player);
		}
	}
}
