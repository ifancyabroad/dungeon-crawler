import Phaser from "phaser";
import {
	DEFAULT_MAP_HEIGHT,
	DEFAULT_MAP_WIDTH,
	idxToXY,
	type FloorConfig,
	type FloorState,
	type GameEvent,
	type GameState,
} from "@app/shared";
import { useGameStore } from "../../features/game/gameStore";
import { useMapStore } from "../../features/map/mapStore";
import { useTargetingStore } from "../../features/targeting/targetingStore";
import { getMapConfigAndHeroFromState } from "../config/getMapConfigFromState";
import { MoveTweenManager } from "../fx/MoveTweenManager";
import { AttackAnimator } from "../fx/AttackAnimator";
import { HealthBarManager } from "../fx/HealthBarManager";
import { DeathFxManager } from "../fx/DeathFxManager";
import { BLOOD_TEXTURE_KEY } from "../fx/particles";
import { DamageNumberManager } from "../fx/DamageNumberManager";
import { SkillAnimationController } from "../skills/SkillAnimationController";
import { TargetingSystem } from "../targeting/TargetingSystem";
import { ActorEffectVisualManager } from "../fx/ActorEffectVisualManager";
import { TILE_HEIGHT, TILE_WIDTH } from "../tiles/tilesetRegistry";
import { ActorSpriteSync } from "./main/actorSpriteSync";
import { createFloorFx, destroyFloorFx } from "./main/mainSceneFxLifecycle";
import type { FloorFxRefs } from "./main/mainSceneFxLifecycle";
import { LootLayerManager } from "./main/LootLayerManager";
import { ChestLayerManager } from "./main/ChestLayerManager";
import { dispatchFxAndSync as dispatchFxPipeline } from "./main/fxOrchestrator";
import { FogOfWarRenderer } from "./main/fogOfWarRenderer";
import { attachKeyboardOnline, attachTargetingEscapeKey } from "./main/inputBindings";
import { TileMarker } from "./main/tileMarker";
import { MouseMovementController } from "./main/mouseMovement";
import { buildMapVisuals } from "./main/mapBuilder";
import { onStoreUpdate } from "./main/turnUpdatePipeline";
import type { SyncState } from "./main/types";

export default class MainScene extends Phaser.Scene {
	private groundLayer: Phaser.Tilemaps.TilemapLayer | null = null;
	private wallLayer: Phaser.Tilemaps.TilemapLayer | null = null;
	private decorationLayer: Phaser.Tilemaps.TilemapLayer | null = null;
	private player: Phaser.GameObjects.Sprite | null = null;
	private playerTileX = 0;
	private playerTileY = 0;
	private mapWidth = DEFAULT_MAP_WIDTH;
	private mapHeight = DEFAULT_MAP_HEIGHT;
	private unsubWaitForState: (() => void) | null = null;
	private unsubHeroSync: (() => void) | null = null;
	private disposed = false;
	private isTransitioning = false;

	private moveTweens: MoveTweenManager | null = null;
	private attackAnimator: AttackAnimator | null = null;
	private healthBars: HealthBarManager | null = null;
	private deathFx: DeathFxManager | null = null;
	private damageNumbers: DamageNumberManager | null = null;
	private goldFx: import("../fx/GoldFxManager").GoldFxManager | null = null;
	private skillAnimController: SkillAnimationController | null = null;
	private targetingSystem: TargetingSystem | null = null;
	private actorEffectVisuals: ActorEffectVisualManager | null = null;
	private lootLayerManager: LootLayerManager | null = null;
	private chestLayerManager: ChestLayerManager | null = null;

	private fogRenderer = new FogOfWarRenderer(DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT);
	private actorSpriteSync = new ActorSpriteSync();
	private tileMarker: TileMarker | null = null;
	private mouseMovement: MouseMovementController | null = null;

	constructor() {
		super("Main");
	}

	create() {
		this.disposed = false;
		this.isTransitioning = false;

		const cleanup = () => {
			this.disposed = true;
			this.unsubWaitForState?.();
			this.unsubWaitForState = null;
			this.unsubHeroSync?.();
			this.unsubHeroSync = null;
			this.mouseMovement?.destroy();
			this.mouseMovement = null;
			this.tileMarker?.destroy();
			this.tileMarker = null;
			this.targetingSystem?.destroy();
			this.targetingSystem = null;
			this.cleanupMapObjects();
			if (useTargetingStore.getState().active) {
				useTargetingStore.getState().exitTargeting();
			}
			if (this.textures.exists(BLOOD_TEXTURE_KEY)) {
				this.textures.remove(BLOOD_TEXTURE_KEY);
			}
		};
		this.events.once("shutdown", cleanup);
		this.events.once("destroy", cleanup);

		const { gameId, state } = useGameStore.getState();
		const fromState = state ? getMapConfigAndHeroFromState(state) : null;
		if (!gameId) return;

		if (fromState) this.buildMapAndHero(fromState.config, fromState.hero);
		else this.subscribeUntilStateArrives();

		attachKeyboardOnline(this, () => this.mouseMovement?.cancelTravel());
		attachTargetingEscapeKey(this);

		// MouseMovement must attach before TargetingSystem so its POINTER_DOWN handler fires
		// first. TargetingSystem.onPointerDown calls exitTargeting() synchronously, which sets
		// active=false before our handler runs — causing false negatives on the targeting guard.
		this.tileMarker = new TileMarker(this);
		this.mouseMovement = new MouseMovementController(
			this,
			fromState?.config.width ?? DEFAULT_MAP_WIDTH,
			fromState?.config.height ?? DEFAULT_MAP_HEIGHT,
		);
		this.mouseMovement.attach(this.tileMarker);

		this.targetingSystem = new TargetingSystem(
			this,
			fromState?.config.width ?? DEFAULT_MAP_WIDTH,
			fromState?.config.height ?? DEFAULT_MAP_HEIGHT,
		);
		this.targetingSystem.attach();
	}

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
		this.mapWidth = config.width;
		this.mapHeight = config.height;
		this.fogRenderer.resetForMap(config.width, config.height);
		useMapStore.getState().setMapConfigOverride(config);

		const stateForExit = useGameStore.getState().state;
		const exitIdx = stateForExit?.floors[heroPos.floorIndex]?.state.exitIdx ?? null;
		const built = buildMapVisuals({ scene: this, config, heroPos, exitIdx });

		this.groundLayer = built.groundLayer;
		this.decorationLayer = built.decorationLayer;
		this.wallLayer = built.wallLayer;
		this.player = built.player;
		this.playerTileX = built.playerTileX;
		this.playerTileY = built.playerTileY;
		if (built.exitSprite && exitIdx !== null) {
			this.fogRenderer.registerFoggedSprite(built.exitSprite, exitIdx);
		}

		this.fogRenderer.setOpacityMask(built.opacityMask);
		this.targetingSystem?.setOpacityMask(built.opacityMask);
		useMapStore.getState().setOpacityMask(built.opacityMask);

		this.cameras.main.startFollow(this.player, true, 1, 1);
		this.targetingSystem?.updateDimensions(this.mapWidth, this.mapHeight);
		this.mouseMovement?.updateDimensions(this.mapWidth, this.mapHeight);

		this.destroyFx();
		this.assignFloorFx(createFloorFx(this, this.mapWidth));
		this.lootLayerManager?.destroyAll();
		this.lootLayerManager = new LootLayerManager(this, this.mapWidth, this.fogRenderer);
		this.chestLayerManager?.destroyAll();
		this.chestLayerManager = new ChestLayerManager(this, this.mapWidth, this.fogRenderer);

		const currentState = useGameStore.getState().state;
		if (currentState) {
			const explored = currentState.floors[currentState.heroFloorIndex]?.state.explored ?? [];
			this.applyFogOfWar(explored, this.playerTileX, this.playerTileY);
			this.syncActors(currentState);
		}

		const syncState: SyncState = {
			lastSyncedIdx: heroPos.idx,
			lastSyncedTurn: currentState?.turn ?? -1,
			lastFloorIndex: heroPos.floorIndex,
			lastDispatchedEventTurn: -1,
		};

		this.unsubHeroSync = useGameStore.subscribe((storeState) => {
			if (this.disposed || this.isTransitioning) return;
			onStoreUpdate(storeState, syncState, {
				mapWidth: this.mapWidth,
				player: this.player,
				getPlayerTilePos: () => ({ x: this.playerTileX, y: this.playerTileY }),
				setPlayerTilePos: (x, y) => {
					this.playerTileX = x;
					this.playerTileY = y;
				},
				triggerFloorTransition: (gs) => this.triggerFloorTransition(gs),
				syncHeroToStore: (idx) => this.syncHeroToStore(idx),
				applyFogOfWar: (explored, heroX, heroY) =>
					this.applyFogOfWar(explored, heroX, heroY),
				dispatchFxAndSync: (events, gs, floor) => this.dispatchFxAndSync(events, gs, floor),
				skillAnimController: this.skillAnimController,
			});
		});
	}

	private dispatchFxAndSync(events: GameEvent[], gs: GameState, floor: FloorState | null): void {
		if (!this.player) return;
		dispatchFxPipeline({
			events,
			gs,
			floor,
			heroSprite: this.player,
			npcSprites: this.actorSpriteSync.getNpcSprites(),
			attackAnimator: this.attackAnimator,
			damageNumbers: this.damageNumbers,
			deathFx: this.deathFx,
			goldFx: this.goldFx,
			skillAnimController: this.skillAnimController,
			onAfterDispatch: () => this.syncActors(gs),
		});
	}

	private triggerFloorTransition(gs: GameState) {
		this.isTransitioning = true;
		this.cameras.main.fadeOut(300, 0, 0, 0);
		this.cameras.main.once("camerafadeoutcomplete", () => {
			if (this.disposed) {
				this.isTransitioning = false;
				return;
			}
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

	private cleanupMapObjects(): void {
		this.groundLayer?.destroy();
		this.groundLayer = null;
		this.decorationLayer?.destroy();
		this.decorationLayer = null;
		this.wallLayer?.destroy();
		this.wallLayer = null;
		this.fogRenderer.destroyFoggedSprites();
		if (this.player) {
			this.player.destroy();
			this.player = null;
		}
		this.actorSpriteSync.clearAndDestroy();
		this.lootLayerManager?.destroyAll();
		this.lootLayerManager = null;
		this.destroyFx();
	}

	private syncActors(gameState: GameState): void {
		this.actorSpriteSync.sync(gameState, {
			scene: this,
			mapWidth: this.mapWidth,
			visibleMask: this.fogRenderer.getVisibleMask(),
			player: this.player,
			moveTweens: this.moveTweens,
			healthBars: this.healthBars,
			actorEffectVisuals: this.actorEffectVisuals,
		});

		const floor = gameState.floors[gameState.heroFloorIndex];
		if (floor && this.lootLayerManager) {
			this.lootLayerManager.sync(floor.state.lootByIdx);
		}
		if (floor && this.chestLayerManager) {
			this.chestLayerManager.sync(floor.state.chestsByIdx);
		}
	}

	private syncHeroToStore(idx: number) {
		if (!this.player) return;
		const { x, y } = idxToXY(idx, this.mapWidth);
		const prevX = this.playerTileX;
		const prevY = this.playerTileY;
		this.playerTileX = x;
		this.playerTileY = y;
		const toX = x * TILE_WIDTH + TILE_WIDTH / 2;
		const toY = y * TILE_HEIGHT + TILE_HEIGHT / 2;
		const diagonal = prevX !== x && prevY !== y;
		if (this.moveTweens) {
			this.moveTweens.moveHero(this.player, toX, toY, diagonal);
		} else {
			this.player.setPosition(toX, toY);
		}
	}

	private applyFogOfWar(explored: number[], heroX: number, heroY: number): void {
		this.fogRenderer.apply(explored, heroX, heroY, [
			this.groundLayer,
			this.decorationLayer,
			this.wallLayer,
		]);
	}

	private destroyFx(): void {
		this.assignFloorFx(
			destroyFloorFx({
				moveTweens: this.moveTweens,
				attackAnimator: this.attackAnimator,
				healthBars: this.healthBars,
				deathFx: this.deathFx,
				damageNumbers: this.damageNumbers,
				goldFx: this.goldFx,
				skillAnimController: this.skillAnimController,
				actorEffectVisuals: this.actorEffectVisuals,
			}),
		);
	}

	private assignFloorFx(refs: FloorFxRefs): void {
		this.moveTweens = refs.moveTweens;
		this.attackAnimator = refs.attackAnimator;
		this.healthBars = refs.healthBars;
		this.deathFx = refs.deathFx;
		this.damageNumbers = refs.damageNumbers;
		this.goldFx = refs.goldFx;
		this.skillAnimController = refs.skillAnimController;
		this.actorEffectVisuals = refs.actorEffectVisuals;
	}
}
