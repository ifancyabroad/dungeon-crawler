import Phaser from "phaser";
import {
	computeOpacityMask,
	computeVisibility,
	DEFAULT_MAP_HEIGHT,
	DEFAULT_MAP_WIDTH,
	getActorAtIdx,
	hasActiveEffect,
	idxToXY,
	xyToIdx,
	MAP_GEN_VERSION,
	regenerateBaseMaps,
	VISION_RADIUS,
	type Action,
	type FloorConfig,
	type FloorState,
	type GameEvent,
	type GameState,
} from "@app/shared";
import {
	ENTITY_TILES,
	getExitTile,
	getHeroTile,
	TILE_HEIGHT,
	TILE_WIDTH,
	TILESET_KEY,
} from "../tiles/tilesetRegistry";
import { useGameStore, type GameStore } from "../../features/game/gameStore";
import { useMapStore } from "../../features/map/mapStore";
import { useTargetingStore } from "../../features/targeting/targetingStore";
import { getMapConfigAndHeroFromState } from "../config/getMapConfigFromState";
import {
	decorationGridToTileIndices,
	toGroundTileIndices,
	toWallTileIndices,
} from "../tiles/mapTileMapping";
import { MoveTweenManager, MOVE_DURATION_MS } from "../fx/MoveTweenManager";
import { AttackAnimator } from "../fx/AttackAnimator";
import { HealthBarManager } from "../fx/HealthBarManager";
import { DeathFxManager } from "../fx/DeathFxManager";
import { BLOOD_TEXTURE_KEY, HERO_BLOOD_COLOR } from "../fx/particles";
import { monstersById, vaults } from "@app/content";
import { DamageNumberManager } from "../fx/DamageNumberManager";
import { SkillAnimationController } from "../skills/SkillAnimationController";
import { TargetingSystem } from "../targeting/TargetingSystem";
import { ActorEffectVisualManager } from "../fx/ActorEffectVisualManager";
import { ALL_ACTOR_OVERLAY_EFFECTS, resolveActorTint } from "../fx/buffVisuals";

const FOG_TINT = 0x555555;

/** Mutable tracking refs shared between buildMapAndHero and onStoreUpdate. */
interface SyncState {
	lastSyncedIdx: number;
	lastSyncedTurn: number;
	lastFloorIndex: number;
	lastDispatchedEventTurn: number;
}

export default class MainScene extends Phaser.Scene {
	private groundLayer: Phaser.Tilemaps.TilemapLayer | null = null;
	private wallLayer: Phaser.Tilemaps.TilemapLayer | null = null;
	private decorationLayer: Phaser.Tilemaps.TilemapLayer | null = null;
	/**
	 * World sprites that receive fog-of-war treatment alongside tilemap tiles.
	 * Any sprite placed at a specific tile idx (exit, items, traps, etc.) can be registered here;
	 * applyFogOfWar will handle visibility automatically without per-sprite custom code.
	 */
	private foggedSprites: Array<{ sprite: Phaser.GameObjects.Sprite; idx: number }> = [];
	private player!: Phaser.GameObjects.Sprite;
	private playerTileX = 0;
	private playerTileY = 0;
	private mapWidth = DEFAULT_MAP_WIDTH;
	private mapHeight = DEFAULT_MAP_HEIGHT;
	/** Precomputed opacity mask for LoS. Set once when map is built. */
	private opacityMask: Uint8Array | null = null;
	/** Currently visible tile indices, recomputed each turn in applyFogOfWar. */
	private visibleMask: Uint8Array | null = null;
	/**
	 * Last-rendered fog state per tile: 0 = hidden, 1 = explored/dim, 2 = visible.
	 * Used to skip tiles that haven't changed, avoiding redundant getTileAt + tint calls.
	 * Double-buffered with tileDisplayBuffer to avoid per-call allocation.
	 */
	private tileDisplayState: Uint8Array | null = null;
	private tileDisplayBuffer: Uint8Array | null = null;
	/** One-shot unsubscribe when we're waiting for state; cleaned up in shutdown(). */
	private unsubWaitForState: (() => void) | null = null;
	/** Unsubscribe from hero position sync; cleaned up in shutdown(). */
	private unsubHeroSync: (() => void) | null = null;
	/** Monster sprites keyed by actor ID. */
	private monsterSprites = new Map<string, Phaser.GameObjects.Sprite>();
	/** Unsubscribe from actor sync. */
	private unsubActorSync: (() => void) | null = null;
	/** Set to true once the scene is shut down or destroyed; guards async subscription callbacks. */
	private disposed = false;
	/** Blocks subscription updates while a floor fade transition is in progress. */
	private isTransitioning = false;

	// FX managers — created per map build, destroyed on cleanup
	private moveTweens: MoveTweenManager | null = null;
	private attackAnimator: AttackAnimator | null = null;
	private healthBars: HealthBarManager | null = null;
	private deathFx: DeathFxManager | null = null;
	private damageNumbers: DamageNumberManager | null = null;
	private skillAnimController: SkillAnimationController | null = null;
	/** Created once in create(); survives floor transitions (input handlers stay attached). */
	private targetingSystem: TargetingSystem | null = null;
	/** Manages persistent buff overlay visuals on the player actor (shield orb, auras, etc.). */
	private actorEffectVisuals: ActorEffectVisualManager | null = null;

	constructor() {
		super("Main");
	}

	create() {
		this.disposed = false;
		// A scene.restart() may interrupt an in-progress floor transition (e.g. Generate Map
		// called while on a non-first floor). Reset the flag so the new scene isn't blocked.
		this.isTransitioning = false;

		const cleanup = () => {
			this.disposed = true;
			this.unsubWaitForState?.();
			this.unsubWaitForState = null;
			this.unsubHeroSync?.();
			this.unsubHeroSync = null;
			this.unsubActorSync?.();
			this.unsubActorSync = null;
			this.monsterSprites.clear();
			this.targetingSystem?.destroy();
			this.targetingSystem = null;
			this.destroyFx();
			// Exit targeting mode if active when scene shuts down
			if (useTargetingStore.getState().active) {
				useTargetingStore.getState().exitTargeting();
			}
			// Blood particle texture is shared across FX managers; remove it once on scene teardown
			if (this.textures.exists(BLOOD_TEXTURE_KEY)) {
				this.textures.remove(BLOOD_TEXTURE_KEY);
			}
		};
		this.events.once("shutdown", cleanup);
		this.events.once("destroy", cleanup);

		const { gameId, state } = useGameStore.getState();
		const fromState = state ? getMapConfigAndHeroFromState(state) : null;

		if (gameId) {
			if (fromState) this.buildMapAndHero(fromState.config, fromState.hero);
			else this.subscribeUntilStateArrives();
			this.attachKeyboardOnline();
			this.attachTargetingEscapeKey();
			// TargetingSystem attaches input/store listeners once; survives floor transitions.
			this.targetingSystem = new TargetingSystem(
				this,
				fromState?.config.width ?? DEFAULT_MAP_WIDTH,
				fromState?.config.height ?? DEFAULT_MAP_HEIGHT,
			);
			this.targetingSystem.attach();
		}
	}

	/** When joining without state: subscribe until state arrives, build map once, then unsubscribe. */
	private subscribeUntilStateArrives() {
		this.unsubWaitForState = useGameStore.subscribe((s) => {
			if (this.disposed) return;
			const fromState = s.state ? getMapConfigAndHeroFromState(s.state) : null;
			if (!fromState) return;
			this.unsubWaitForState?.();
			this.unsubWaitForState = null;
			if (this.scene.isActive()) this.buildMapAndHero(fromState.config, fromState.hero);
		});
	}

	private buildMapAndHero(
		config: FloorConfig & { seed: number },
		heroPos: { floorIndex: number; idx: number; classId: string },
	) {
		// Reset fog diff state so the new tilemap (all tiles alpha=1 by default)
		// is fully re-evaluated rather than diffed against a stale previous map.
		this.tileDisplayState = null;
		this.tileDisplayBuffer = null;
		this.mapWidth = config.width;
		this.mapHeight = config.height;
		useMapStore.getState().setMapConfigOverride(config);

		// Run the full single-floor pipeline via shared — identical stages and order to the server.
		// config.seed is already gameSeed + floorIndex (set by getMapConfigFromState).
		// regenerateBaseMaps uses seed+0 for the first (only) floor, which equals config.seed.
		const [base] = regenerateBaseMaps(config.seed, [config], MAP_GEN_VERSION, {
			vaultDefs: vaults,
		});
		const { ground, wall, waterMask, decorationGrid, vaultPlacements } = base;

		const groundData = toGroundTileIndices(ground, wall, waterMask, config.theme, config.seed);
		const wallData = toWallTileIndices(wall, config.theme, config.seed);
		const decorationData = decorationGridToTileIndices(
			decorationGrid,
			config.theme,
			config.seed,
		);

		// Bake vault tile overrides into the layer data arrays before the tilemaps are created.
		// putTileAt cannot place tiles on cells that were -1 in the source data because Phaser
		// creates no tile object for empty cells.
		for (const placement of vaultPlacements) {
			for (const [flatIdxStr, tileId] of Object.entries(placement.groundOverrides)) {
				const flatIdx = Number(flatIdxStr);
				const x = flatIdx % config.width;
				const y = Math.floor(flatIdx / config.width);
				if (groundData[y]) groundData[y][x] = tileId;
			}
			for (const [flatIdxStr, tileId] of Object.entries(placement.wallOverrides)) {
				const flatIdx = Number(flatIdxStr);
				const x = flatIdx % config.width;
				const y = Math.floor(flatIdx / config.width);
				if (wallData[y]) wallData[y][x] = tileId;
			}
			for (const [flatIdxStr, tileId] of Object.entries(placement.decorationOverrides)) {
				const flatIdx = Number(flatIdxStr);
				const x = flatIdx % config.width;
				const y = Math.floor(flatIdx / config.width);
				if (decorationData[y]) decorationData[y][x] = tileId;
			}
		}

		this.createGroundLayer(groundData);
		this.createDecorationLayer(decorationData);
		this.createWallLayer(wallData);

		this.opacityMask = computeOpacityMask(wall, config.width, config.height);
		this.targetingSystem?.setOpacityMask(this.opacityMask);
		useMapStore.getState().setOpacityMask(this.opacityMask);

		// Place exit sprite and register it for fog-of-war treatment
		const stateForExit = useGameStore.getState().state;
		const exitIdx = stateForExit?.floors[heroPos.floorIndex]?.state.exitIdx ?? null;
		if (exitIdx !== null) {
			const { x: ex, y: ey } = idxToXY(exitIdx, config.width);
			const exitSprite = this.add.sprite(
				ex * TILE_WIDTH + TILE_WIDTH / 2,
				ey * TILE_HEIGHT + TILE_HEIGHT / 2,
				TILESET_KEY,
				getExitTile(config.theme),
			);
			exitSprite.setOrigin(0.5, 0.5);
			exitSprite.setDepth(2);
			exitSprite.setAlpha(0);
			this.foggedSprites.push({ sprite: exitSprite, idx: exitIdx });
		}

		const spawnPos = idxToXY(heroPos.idx, config.width);
		this.playerTileX = spawnPos.x;
		this.playerTileY = spawnPos.y;
		const startX = this.playerTileX * TILE_WIDTH + TILE_WIDTH / 2;
		const startY = this.playerTileY * TILE_HEIGHT + TILE_HEIGHT / 2;
		this.player = this.add.sprite(startX, startY, TILESET_KEY, getHeroTile(heroPos.classId));
		this.player.setOrigin(0.5, 0.5);
		this.player.setDepth(10);

		// No setBounds: keep hero always centered; at map edges the camera may show empty space.
		this.cameras.main.startFollow(this.player, true, 1, 1);

		// Update TargetingSystem dimensions for the new floor (it survives buildMapAndHero).
		this.targetingSystem?.updateDimensions(this.mapWidth, this.mapHeight);

		// Initialise per-map FX managers (destroyed and re-created on each floor).
		this.destroyFx();
		this.moveTweens = new MoveTweenManager(this);
		this.attackAnimator = new AttackAnimator(this, this.mapWidth);
		this.healthBars = new HealthBarManager(this);
		this.deathFx = new DeathFxManager(this, this.mapWidth);
		this.damageNumbers = new DamageNumberManager(this, this.mapWidth);
		this.skillAnimController = new SkillAnimationController(this, this.mapWidth);

		this.actorEffectVisuals = new ActorEffectVisualManager(this);
		for (const effect of ALL_ACTOR_OVERLAY_EFFECTS) {
			this.actorEffectVisuals.register(effect);
		}

		const currentState = useGameStore.getState().state;
		if (currentState) {
			const explored = currentState.floors[currentState.heroFloorIndex]?.state.explored ?? [];
			this.applyFogOfWar(explored, this.playerTileX, this.playerTileY);
			this.syncMonsters(currentState);
		}

		const syncState: SyncState = {
			lastSyncedIdx: heroPos.idx,
			lastSyncedTurn: currentState?.turn ?? -1,
			lastFloorIndex: heroPos.floorIndex,
			lastDispatchedEventTurn: -1,
		};
		this.unsubHeroSync = useGameStore.subscribe((storeState) => {
			if (this.disposed || this.isTransitioning) return;
			this.onStoreUpdate(storeState, syncState);
		});
	}

	/**
	 * Per-turn rendering callback fired by the store subscription.
	 * Owns all turn-driven logic: floor transition detection, hero sync,
	 * fog of war, FX dispatch, and monster sync.
	 */
	private onStoreUpdate(storeState: GameStore, sync: SyncState) {
		const gs = storeState.state;

		// Floor change: slide hero onto exit tile and fade out simultaneously, then rebuild → fade-in
		if (gs && gs.heroFloorIndex !== sync.lastFloorIndex) {
			const fromFloor = sync.lastFloorIndex;
			sync.lastFloorIndex = gs.heroFloorIndex;
			const exitIdx = gs.floors[fromFloor]?.state.exitIdx;
			if (exitIdx != null && this.player) {
				const { x: ex, y: ey } = idxToXY(exitIdx, this.mapWidth);
				this.tweens.add({
					targets: this.player,
					x: ex * TILE_WIDTH + TILE_WIDTH / 2,
					y: ey * TILE_HEIGHT + TILE_HEIGHT / 2,
					duration: MOVE_DURATION_MS,
					ease: Phaser.Math.Easing.Sine.Out,
				});
			}
			this.triggerFloorTransition(gs);
			return;
		}

		const turnChanged = gs != null && gs.turn !== sync.lastSyncedTurn;

		if (gs && turnChanged) {
			sync.lastSyncedTurn = gs.turn;
			const floor = gs.floors[gs.heroFloorIndex];
			const explored = floor?.state.explored ?? [];

			// Events are only fresh when the store's event-turn matches this turn.
			// lastOptimisticEventTurn records which turn produced the current events[].
			const eventTurn = storeState.lastOptimisticEventTurn;
			const freshEvents =
				storeState.events.length > 0 &&
				eventTurn === gs.turn &&
				eventTurn !== sync.lastDispatchedEventTurn;
			const events = freshEvents ? storeState.events : [];

			if (freshEvents) sync.lastDispatchedEventTurn = eventTurn;

			const heroMoved = storeState.hero.idx !== sync.lastSyncedIdx;

			// Check for a hero skill event to drive special animations.
			const skillUsedEvent = events.find(
				(e): e is Extract<typeof e, { type: "skill_used" }> =>
					e.type === "skill_used" && e.actorId === gs.heroId,
			);

			let fxDeferred = false;
			if (skillUsedEvent && this.skillAnimController) {
				const onImpact = () => this.dispatchFxAndSync(events, gs, floor?.state ?? null);
				const animResult = this.skillAnimController.handle(
					skillUsedEvent,
					this.player,
					storeState.hero.idx,
					heroMoved,
					onImpact,
				);

				if (animResult.handled) {
					sync.lastSyncedIdx = storeState.hero.idx;
					fxDeferred = animResult.fxDeferred;
					// Skill moved the hero (e.g. charge): update tile tracker for LoS.
					if (animResult.newHeroTilePos) {
						this.playerTileX = animResult.newHeroTilePos.x;
						this.playerTileY = animResult.newHeroTilePos.y;
					}
				} else if (heroMoved) {
					sync.lastSyncedIdx = storeState.hero.idx;
					this.syncHeroToStore(storeState.hero.idx);
				}
			} else if (heroMoved) {
				sync.lastSyncedIdx = storeState.hero.idx;
				this.syncHeroToStore(storeState.hero.idx);
			}

			this.applyFogOfWar(explored, this.playerTileX, this.playerTileY);

			// Apply stealth alpha to hero sprite.
			if (this.player && floor) {
				const heroActor = floor.state.actorsById[gs.heroId];
				if (heroActor) {
					this.player.setAlpha(hasActiveEffect(heroActor, "stealth") ? 0.4 : 1.0);
				}
			}

			// If no skill animation deferred FX, dispatch immediately.
			if (!fxDeferred) {
				this.dispatchFxAndSync(events, gs, floor?.state ?? null);
			}
		} else if (storeState.hero.idx !== sync.lastSyncedIdx) {
			// Turn unchanged but hero idx drifted (e.g. server correction).
			sync.lastSyncedIdx = storeState.hero.idx;
			this.syncHeroToStore(storeState.hero.idx);
		}
	}

	/**
	 * Dispatch events to all FX managers (attack bumps, damage numbers, death particles)
	 * and then sync the monster sprite map.  Extracted so it can be called either
	 * immediately (normal turns) or deferred inside a skill animation callback (fireball,
	 * charge) so that monsters remain visible until the animation resolves.
	 */
	private dispatchFxAndSync(events: GameEvent[], gs: GameState, floor: FloorState | null): void {
		if (events.length > 0 && floor) {
			const actorsById = floor.actorsById;
			const getActorIdx = (id: string) => actorsById[id]?.idx;
			const getBloodColor = (id: string): string => {
				const actor = actorsById[id];
				if (!actor || actor.def.type !== "monster") return HERO_BLOOD_COLOR;
				return (
					(monstersById as Record<string, { bloodColor: string }>)[actor.def.monsterId]
						?.bloodColor ?? HERO_BLOOD_COLOR
				);
			};

			this.attackAnimator?.playEvents(
				events,
				gs.heroId,
				this.player,
				this.monsterSprites,
				getActorIdx,
				getBloodColor,
			);
			this.damageNumbers?.handleEvents(events, getActorIdx);
			this.deathFx?.handleEvents(events, gs.heroId, getActorIdx, getBloodColor);
		}
		this.syncMonsters(gs);
	}

	/**
	 * Fade out camera, destroy current map objects, rebuild for new floor, then fade in.
	 * Called when heroFloorIndex changes in the game store.
	 */
	private triggerFloorTransition(gs: GameState) {
		this.isTransitioning = true;
		this.cameras.main.fadeOut(300, 0, 0, 0);
		this.cameras.main.once("camerafadeoutcomplete", () => {
			if (this.disposed) {
				this.isTransitioning = false;
				return;
			}
			// Unsubscribe old sync before rebuilding to prevent double-subscription
			this.unsubHeroSync?.();
			this.unsubHeroSync = null;

			const fromState = getMapConfigAndHeroFromState(gs);
			if (!fromState) {
				this.isTransitioning = false;
				return;
			}

			this.cleanupMapObjects();
			this.isTransitioning = false;
			this.buildMapAndHero(fromState.config, fromState.hero);
			this.cameras.main.fadeIn(300, 0, 0, 0);
		});
	}

	/** Destroy all current map layers, fogged world sprites, player, and monster sprites. */
	private cleanupMapObjects(): void {
		this.tileDisplayState = null;
		this.tileDisplayBuffer = null;
		this.groundLayer?.destroy();
		this.groundLayer = null;
		this.decorationLayer?.destroy();
		this.decorationLayer = null;
		this.wallLayer?.destroy();
		this.wallLayer = null;
		for (const { sprite } of this.foggedSprites) {
			sprite.destroy();
		}
		this.foggedSprites = [];
		if (this.player) {
			this.player.destroy();
		}
		for (const sprite of this.monsterSprites.values()) {
			sprite.destroy();
		}
		this.monsterSprites.clear();
		this.destroyFx();
	}

	/** Synchronize monster sprites with the current game state. */
	private syncMonsters(gameState: GameState) {
		const floor = gameState.floors[gameState.heroFloorIndex];
		if (!floor) return;
		const actorsById = floor.state.actorsById;

		// Update or create monster sprites
		for (const [id, actor] of Object.entries(actorsById)) {
			if (id === gameState.heroId) continue;
			if (actor.def.type !== "monster") continue;

			const existing = this.monsterSprites.get(id);
			if (!actor.alive) {
				if (existing) {
					existing.destroy();
					this.monsterSprites.delete(id);
					this.healthBars?.remove(id);
				}
				continue;
			}

			const { x, y } = idxToXY(actor.idx, this.mapWidth);
			const px = x * TILE_WIDTH + TILE_WIDTH / 2;
			const py = y * TILE_HEIGHT + TILE_HEIGHT / 2;
			const tileFrame = ENTITY_TILES.monsters[actor.def.monsterId];
			if (tileFrame === undefined) continue;

			const isVisible = this.visibleMask?.[actor.idx] === 1;

			if (existing) {
				this.moveTweens?.moveMonster(id, existing, px, py);
				existing.setFrame(tileFrame);
				existing.setVisible(isVisible);
				if (isVisible) {
					this.healthBars?.update(id, actor.hp, actor.maxHp, existing);
				}
			} else {
				const sprite = this.add.sprite(px, py, TILESET_KEY, tileFrame);
				sprite.setOrigin(0.5, 0.5);
				sprite.setDepth(9);
				sprite.setVisible(isVisible);
				this.monsterSprites.set(id, sprite);
				if (isVisible) {
					this.healthBars?.update(id, actor.hp, actor.maxHp, sprite);
				}
			}
		}

		// Remove sprites for actors that were removed from state entirely.
		// The alive=false case is fully handled in the loop above.
		for (const [id, sprite] of this.monsterSprites) {
			if (!actorsById[id]) {
				sprite.destroy();
				this.monsterSprites.delete(id);
				this.healthBars?.remove(id);
			}
		}

		// Update hero health bar and buff visuals.
		const hero = actorsById[gameState.heroId];
		if (hero && this.player) {
			const shieldHp = hero.numericBuffs?.["shieldHp"] ?? 0;
			this.healthBars?.update(gameState.heroId, hero.hp, hero.maxHp, this.player, shieldHp);

			// Sprite tint — driven by the ACTOR_STATUS_TINTS registry in buffVisuals/actorStatusTints.ts.
			this.player.setTint(resolveActorTint(hero));

			// Overlay visuals (orbs, auras) — driven by ALL_ACTOR_OVERLAY_EFFECTS registry.
			this.actorEffectVisuals?.sync(hero, this.player.x, this.player.y);
		}
	}

	private attachKeyboardOnline() {
		const directionAction = (direction: "up" | "down" | "left" | "right") => {
			// Moving cancels targeting mode without sending a move action.
			if (useTargetingStore.getState().active) {
				useTargetingStore.getState().exitTargeting();
				return;
			}
			const { sendAction, state } = useGameStore.getState();
			if (!state) return;
			const action = this.resolveDirectionAction(state, direction);
			sendAction(action);
		};
		this.input.keyboard?.on("keydown-W", () => directionAction("up"));
		this.input.keyboard?.on("keydown-S", () => directionAction("down"));
		this.input.keyboard?.on("keydown-A", () => directionAction("left"));
		this.input.keyboard?.on("keydown-D", () => directionAction("right"));
	}

	/**
	 * Determine whether a WASD press should be a move or attack.
	 * If a living enemy occupies the target tile, send an attack action.
	 */
	private resolveDirectionAction(
		state: GameState,
		direction: "up" | "down" | "left" | "right",
	): Action {
		const floor = state.floors[state.heroFloorIndex];
		if (!floor) return { type: "move", direction };
		const hero = floor.state.actorsById[state.heroId];
		if (!hero) return { type: "move", direction };

		const DELTA: Record<string, { dx: number; dy: number }> = {
			up: { dx: 0, dy: -1 },
			down: { dx: 0, dy: 1 },
			left: { dx: -1, dy: 0 },
			right: { dx: 1, dy: 0 },
		};
		const { dx, dy } = DELTA[direction];
		const { x, y } = idxToXY(hero.idx, floor.config.width);
		const nx = x + dx;
		const ny = y + dy;
		if (nx < 0 || nx >= floor.config.width || ny < 0 || ny >= floor.config.height) {
			return { type: "move", direction };
		}
		const targetIdx = xyToIdx(nx, ny, floor.config.width);
		const enemy = getActorAtIdx(floor.state, targetIdx);
		if (enemy && enemy.id !== state.heroId) {
			return { type: "attack", direction };
		}
		return { type: "move", direction };
	}

	/** Apply hero tile index from store to sprite position via tween. */
	private syncHeroToStore(idx: number) {
		if (!this.player) return;
		const { x, y } = idxToXY(idx, this.mapWidth);
		this.playerTileX = x;
		this.playerTileY = y;
		const toX = x * TILE_WIDTH + TILE_WIDTH / 2;
		const toY = y * TILE_HEIGHT + TILE_HEIGHT / 2;
		if (this.moveTweens) {
			this.moveTweens.moveHero(this.player, toX, toY);
		} else {
			this.player.setPosition(toX, toY);
		}
	}

	private createGroundLayer(groundData: number[][]) {
		const map = this.make.tilemap({
			data: groundData,
			tileWidth: TILE_WIDTH,
			tileHeight: TILE_HEIGHT,
		});
		const tileset = map.addTilesetImage(TILESET_KEY);
		if (!tileset) {
			console.error("Tileset not found:", TILESET_KEY);
			return;
		}
		this.groundLayer = map.createLayer(0, tileset, 0, 0);
		if (!this.groundLayer) {
			console.error("Failed to create ground layer");
			return;
		}
	}

	private createDecorationLayer(decorationData: number[][]) {
		const decMap = this.make.tilemap({
			data: decorationData,
			tileWidth: TILE_WIDTH,
			tileHeight: TILE_HEIGHT,
		});
		const decTileset = decMap.addTilesetImage(TILESET_KEY);
		this.decorationLayer = null;
		if (decTileset) {
			this.decorationLayer = decMap.createLayer(0, decTileset, 0, 0);
			if (this.decorationLayer) this.decorationLayer.setDepth(1);
		}
	}

	private createWallLayer(wallData: number[][]) {
		const wallMap = this.make.tilemap({
			data: wallData,
			tileWidth: TILE_WIDTH,
			tileHeight: TILE_HEIGHT,
		});
		const wallTileset = wallMap.addTilesetImage(TILESET_KEY);
		if (!wallTileset) {
			console.error("Tileset not found for wall layer");
			return;
		}
		this.wallLayer = wallMap.createLayer(0, wallTileset, 0, 0);
		if (!this.wallLayer) {
			console.error("Failed to create wall layer");
			return;
		}
	}

	/**
	 * Update tile rendering for fog of war.
	 * - Unexplored: tile hidden
	 * - Explored but not currently visible: dark tint
	 * - Visible: normal
	 *
	 * Diff-based: computes new per-tile display state (0/1/2) and only calls
	 * getTileAt + sets tint/alpha on tiles whose state actually changed. On a
	 * 65×65 map this reduces per-move tile operations from ~12k to the ~few
	 * hundred tiles near the vision boundary.
	 */
	private applyFogOfWar(explored: number[], heroX: number, heroY: number) {
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

		// Reuse pre-allocated buffer to avoid per-call heap allocation.
		if (!this.tileDisplayBuffer || this.tileDisplayBuffer.length !== size) {
			this.tileDisplayBuffer = new Uint8Array(size);
		}
		const next = this.tileDisplayBuffer;

		// Compute new state for each tile; only call getTileAt on tiles that changed.
		const layers = [this.groundLayer, this.decorationLayer, this.wallLayer];
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

		// Swap buffers: next becomes current, old current becomes the write buffer next call.
		this.tileDisplayState = next;
		this.tileDisplayBuffer = prev ?? new Uint8Array(size);

		// Apply fog-of-war to registered world sprites (exit, items, traps, etc.)
		for (const { sprite, idx } of this.foggedSprites) {
			const state = next[idx];
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
	}

	// ---------------------------------------------------------------------------
	// Targeting overlay
	// ---------------------------------------------------------------------------

	/** ESC key cancels targeting mode. Pointer handling lives in TargetingSystem. */
	private attachTargetingEscapeKey(): void {
		this.input.keyboard?.on("keydown-ESC", () => {
			if (useTargetingStore.getState().active) {
				useTargetingStore.getState().exitTargeting();
			}
		});
	}

	private destroyFx(): void {
		this.moveTweens?.destroy();
		this.moveTweens = null;
		this.attackAnimator?.destroy();
		this.attackAnimator = null;
		this.healthBars?.destroy();
		this.healthBars = null;
		this.skillAnimController = null;
		this.actorEffectVisuals?.destroy();
		this.actorEffectVisuals = null;
		// DeathFxManager and DamageNumberManager have no state to clean up —
		// all emitters and labels self-destruct via tweens/delayedCall
		this.deathFx = null;
		this.damageNumbers = null;
	}
}
