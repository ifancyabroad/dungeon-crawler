import Phaser from "phaser";
import {
	buildDecorationLayer,
	buildWaterMask,
	computeOpacityMask,
	computeVisibility,
	createRng,
	DEFAULT_MAP_HEIGHT,
	DEFAULT_MAP_WIDTH,
	generateMap,
	getActorAtIdx,
	idxToXY,
	xyToIdx,
	VISION_RADIUS,
	type Action,
	type GameState,
	type MapGenConfig,
} from "@app/shared";
import {
	ENTITY_TILES,
	getCollidingIndices,
	getHeroTile,
	TILE_HEIGHT,
	TILE_WIDTH,
	TILESET_KEY,
} from "../tiles/tilesetRegistry";
import { useGameStore } from "../../features/game/gameStore";
import { useMapStore } from "../../features/map/mapStore";
import { getMapConfigAndHeroFromState } from "../config/getMapConfigFromState";
import {
	decorationGridToTileIndices,
	toGroundTileIndices,
	toWallTileIndices,
} from "../tiles/mapTileMapping";

const FOG_TINT = 0x555555;

export default class MainScene extends Phaser.Scene {
	private groundLayer: Phaser.Tilemaps.TilemapLayer | null = null;
	private wallLayer: Phaser.Tilemaps.TilemapLayer | null = null;
	private decorationLayer: Phaser.Tilemaps.TilemapLayer | null = null;
	private player!: Phaser.GameObjects.Sprite;
	private playerTileX = 0;
	private playerTileY = 0;
	private mapWidth = DEFAULT_MAP_WIDTH;
	private mapHeight = DEFAULT_MAP_HEIGHT;
	/** Precomputed opacity mask for LoS. Set once when map is built. */
	private opacityMask: Uint8Array | null = null;
	/** Currently visible tile indices, recomputed each turn in applyFogOfWar. */
	private visibleMask: Uint8Array | null = null;
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

	constructor() {
		super("Main");
	}

	create() {
		this.disposed = false;

		const cleanup = () => {
			this.disposed = true;
			this.unsubWaitForState?.();
			this.unsubWaitForState = null;
			this.unsubHeroSync?.();
			this.unsubHeroSync = null;
			this.unsubActorSync?.();
			this.unsubActorSync = null;
			this.monsterSprites.clear();
		};
		this.events.once("shutdown", cleanup);
		this.events.once("destroy", cleanup);

		const { gameId, state } = useGameStore.getState();
		const fromState = state ? getMapConfigAndHeroFromState(state) : null;

		if (gameId) {
			if (fromState) this.buildMapAndHero(fromState.config, fromState.hero);
			else this.subscribeUntilStateArrives();
			this.attachKeyboardOnline();
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
		config: MapGenConfig,
		heroPos: { floorIndex: number; idx: number; classId: string },
		optionalConfigForSpawn?: MapGenConfig,
	) {
		this.mapWidth = config.width;
		this.mapHeight = config.height;
		useMapStore.getState().setMapConfigOverride(config);

		const rng = createRng(config.seed);
		const { ground, wall, spawn, pathLayer } = generateMap(config, rng);

		const waterMask = buildWaterMask(ground, wall, spawn, config.seed);
		const { decorationGrid } = buildDecorationLayer(
			ground,
			wall,
			pathLayer,
			waterMask,
			spawn,
			config.seed,
			config.decorationWeights,
			config.scatterChance,
		);

		const groundData = toGroundTileIndices(ground, wall, waterMask, config.theme, config.seed);
		const wallData = toWallTileIndices(wall, config.theme, config.seed);
		const decorationData = decorationGridToTileIndices(decorationGrid, config.theme);

		this.createGroundLayer(groundData);
		this.createDecorationLayer(decorationData);
		this.createWallLayer(wallData);

		this.opacityMask = computeOpacityMask(wall, config.width, config.height);

		const spawnPos = optionalConfigForSpawn
			? { x: spawn.x, y: spawn.y }
			: idxToXY(heroPos.idx, config.width);
		this.playerTileX = spawnPos.x;
		this.playerTileY = spawnPos.y;
		const startX = this.playerTileX * TILE_WIDTH + TILE_WIDTH / 2;
		const startY = this.playerTileY * TILE_HEIGHT + TILE_HEIGHT / 2;
		this.player = this.add.sprite(startX, startY, TILESET_KEY, getHeroTile(heroPos.classId));
		this.player.setOrigin(0.5, 0.5);
		this.player.setDepth(10);

		// No setBounds: keep hero always centered; at map edges the camera may show empty space.
		this.cameras.main.startFollow(this.player, true, 1, 1);

		const currentState = useGameStore.getState().state;
		if (currentState) {
			const explored = currentState.floors[currentState.heroFloorIndex]?.state.explored ?? [];
			this.applyFogOfWar(explored, this.playerTileX, this.playerTileY);
			this.syncMonsters(currentState);
		}

		let lastSyncedIdx = heroPos.idx;
		let lastSyncedTurn = currentState?.turn ?? -1;
		this.unsubHeroSync = useGameStore.subscribe((storeState) => {
			if (this.disposed) return;
			const gs = storeState.state;
			const turnChanged = gs != null && gs.turn !== lastSyncedTurn;

			if (storeState.hero.idx !== lastSyncedIdx) {
				lastSyncedIdx = storeState.hero.idx;
				this.syncHeroToStore(storeState.hero.idx);
			}

			if (gs && turnChanged) {
				lastSyncedTurn = gs.turn;
				const explored = gs.floors[gs.heroFloorIndex]?.state.explored ?? [];
				this.applyFogOfWar(explored, this.playerTileX, this.playerTileY);
				this.syncMonsters(gs);
			}
		});
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
				existing.setPosition(px, py);
				existing.setFrame(tileFrame);
				existing.setVisible(isVisible);
			} else {
				const sprite = this.add.sprite(px, py, TILESET_KEY, tileFrame);
				sprite.setOrigin(0.5, 0.5);
				sprite.setDepth(9);
				sprite.setVisible(isVisible);
				this.monsterSprites.set(id, sprite);
			}
		}

		// Remove sprites for actors no longer in state
		for (const [id, sprite] of this.monsterSprites) {
			if (!actorsById[id] || !actorsById[id].alive) {
				sprite.destroy();
				this.monsterSprites.delete(id);
			}
		}
	}

	private attachKeyboardOnline() {
		const directionAction = (direction: "up" | "down" | "left" | "right") => {
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

	/** Apply hero tile index from store to sprite position (called from store subscription). */
	private syncHeroToStore(idx: number) {
		if (!this.player) return;
		const { x, y } = idxToXY(idx, this.mapWidth);
		this.playerTileX = x;
		this.playerTileY = y;
		this.player.setPosition(x * TILE_WIDTH + TILE_WIDTH / 2, y * TILE_HEIGHT + TILE_HEIGHT / 2);
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
		map.setCollision(getCollidingIndices());
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
		wallMap.setCollision(getCollidingIndices());
	}

	/**
	 * Update tile rendering for fog of war.
	 * - Unexplored: tile hidden
	 * - Explored but not currently visible: dark tint
	 * - Visible: normal
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

		const layers = [this.groundLayer, this.decorationLayer, this.wallLayer];
		for (const layer of layers) {
			if (!layer) continue;
			for (let y = 0; y < this.mapHeight; y++) {
				for (let x = 0; x < this.mapWidth; x++) {
					const tile = layer.getTileAt(x, y);
					if (!tile) continue;
					const idx = y * this.mapWidth + x;
					if (visible[idx] === 1) {
						tile.setAlpha(1);
						tile.tint = 0xffffff;
					} else if (explored[idx] === 1) {
						tile.setAlpha(1);
						tile.tint = FOG_TINT;
					} else {
						tile.setAlpha(0);
					}
				}
			}
		}
	}
}
