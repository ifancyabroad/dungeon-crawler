import Phaser from "phaser";
import {
	buildDecorationLayer,
	buildWaterMask,
	createRng,
	DEFAULT_MAP_HEIGHT,
	DEFAULT_MAP_WIDTH,
	generateMap,
	isCellWalkable,
} from "@app/shared";
import type { MapGenConfig } from "@app/shared";
import {
	DECORATION_WEIGHTS,
	ENTITIES,
	getCollidingIndices,
	TILE_HEIGHT,
	TILE_WIDTH,
	TILESET_KEY,
} from "../tiles/tilesetRegistry";
import { useGameStore } from "../../stores/gameStore";
import { useMapStore } from "../../stores/mapStore";
import { getMapConfigAndHeroFromState } from "../config/getMapConfigFromState";
import { getMapConfig } from "../config/mapConfig";
import type { MapConfig } from "../config/mapConfig";
import {
	decorationGridToTileIndices,
	toGroundTileIndices,
	toWallTileIndices,
} from "../tiles/mapTileMapping";

export default class MainScene extends Phaser.Scene {
	private groundLayer: Phaser.Tilemaps.TilemapLayer | null = null;
	private wallLayer: Phaser.Tilemaps.TilemapLayer | null = null;
	private decorationLayer: Phaser.Tilemaps.TilemapLayer | null = null;
	/** Logical map state for shared isCellWalkable (server-authoritative rule). */
	private ground: number[][] = [];
	private wall: number[][] = [];
	private blockedMask: boolean[][] = [];
	private player!: Phaser.GameObjects.Sprite;
	private playerTileX = 0;
	private playerTileY = 0;
	private isMoving = false;
	private mapWidth = DEFAULT_MAP_WIDTH;
	private mapHeight = DEFAULT_MAP_HEIGHT;
	/** One-shot unsubscribe when we're waiting for state; cleaned up in shutdown(). */
	private unsubWaitForState: (() => void) | null = null;

	constructor() {
		super("Main");
	}

	create() {
		const { gameId, state } = useGameStore.getState();
		const fromState = state ? getMapConfigAndHeroFromState(state) : null;

		if (gameId) {
			if (fromState) this.buildMapAndHero(fromState.config, fromState.hero);
			else this.subscribeUntilStateArrives();
			this.attachKeyboardOnline();
		} else {
			const config = getMapConfig();
			this.buildMapAndHero(config, { floorIndex: 0, x: 0, y: 0 }, config);
			this.attachKeyboardOffline();
		}
	}

	/** Subscribe to game store; when state arrives, build map once and unsubscribe. */
	private subscribeUntilStateArrives() {
		this.unsubWaitForState = useGameStore.subscribe((s) => {
			const fromState = s.state ? getMapConfigAndHeroFromState(s.state) : null;
			if (!fromState) return;
			this.unsubWaitForState?.();
			this.unsubWaitForState = null;
			if (this.scene.isActive()) this.buildMapAndHero(fromState.config, fromState.hero);
		});
		this.events.once("shutdown", () => {
			this.unsubWaitForState?.();
			this.unsubWaitForState = null;
		});
	}

	private buildMapAndHero(
		config: MapGenConfig | MapConfig,
		heroPos: { floorIndex: number; x: number; y: number },
		optionalConfigForSpawn?: MapConfig,
	) {
		this.mapWidth = config.width;
		this.mapHeight = config.height;
		useMapStore.getState().setMapConfigOverride(config as MapConfig);

		const rng = createRng(config.seed);
		const { ground, wall, spawn, pathLayer } = generateMap(config, rng);

		const waterMask = buildWaterMask(ground, wall, spawn, config.seed);
		const { blockedMask, decorationGrid } = buildDecorationLayer(
			ground,
			wall,
			pathLayer,
			waterMask,
			spawn,
			config.seed,
			config.decorationWeights ?? DECORATION_WEIGHTS,
			(config as MapConfig).scatterChance ?? 0.28,
		);
		this.ground = ground;
		this.wall = wall;
		this.blockedMask = blockedMask;

		const groundData = toGroundTileIndices(ground, wall, waterMask, config.theme);
		const wallData = toWallTileIndices(wall, config.theme);
		const decorationData = decorationGridToTileIndices(decorationGrid, config.theme);

		this.createGroundLayer(groundData);
		this.createDecorationLayer(decorationData);
		this.createWallLayer(wallData);

		const spawnPos = optionalConfigForSpawn ? { x: spawn.x, y: spawn.y } : heroPos;
		this.playerTileX = spawnPos.x;
		this.playerTileY = spawnPos.y;
		const startX = this.playerTileX * TILE_WIDTH + TILE_WIDTH / 2;
		const startY = this.playerTileY * TILE_HEIGHT + TILE_HEIGHT / 2;
		this.player = this.add.sprite(startX, startY, TILESET_KEY, ENTITIES.HERO);
		this.player.setOrigin(0.5, 0.5);
		this.player.setDepth(10);

		this.cameras.main.setBounds(0, 0, this.mapWidth * TILE_WIDTH, this.mapHeight * TILE_HEIGHT);
		this.cameras.main.startFollow(this.player, true);
	}

	private attachKeyboardOnline() {
		const sendAction = useGameStore.getState().sendAction;
		this.input.keyboard?.on("keydown-W", () => sendAction({ type: "move", direction: "up" }));
		this.input.keyboard?.on("keydown-S", () => sendAction({ type: "move", direction: "down" }));
		this.input.keyboard?.on("keydown-A", () => sendAction({ type: "move", direction: "left" }));
		this.input.keyboard?.on("keydown-D", () =>
			sendAction({ type: "move", direction: "right" }),
		);
	}

	private attachKeyboardOffline() {
		this.input.keyboard?.on("keydown-W", () => this.tryMove(0, -1));
		this.input.keyboard?.on("keydown-S", () => this.tryMove(0, 1));
		this.input.keyboard?.on("keydown-A", () => this.tryMove(-1, 0));
		this.input.keyboard?.on("keydown-D", () => this.tryMove(1, 0));
	}

	setHeroPosition(x: number, y: number) {
		this.playerTileX = x;
		this.playerTileY = y;
		const worldX = x * TILE_WIDTH + TILE_WIDTH / 2;
		const worldY = y * TILE_HEIGHT + TILE_HEIGHT / 2;
		if (!this.player) return;
		this.isMoving = true;
		this.tweens.add({
			targets: this.player,
			x: worldX,
			y: worldY,
			duration: 120,
			ease: "Power2",
			onComplete: () => {
				this.isMoving = false;
			},
		});
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

	private isWalkable(tileX: number, tileY: number): boolean {
		return isCellWalkable(this.ground, this.wall, this.blockedMask, tileX, tileY);
	}

	private tryMove(dx: number, dy: number) {
		if (this.isMoving) return;
		const targetX = this.playerTileX + dx;
		const targetY = this.playerTileY + dy;
		if (!this.isWalkable(targetX, targetY)) return;

		this.isMoving = true;
		this.playerTileX = targetX;
		this.playerTileY = targetY;
		const worldX = targetX * TILE_WIDTH + TILE_WIDTH / 2;
		const worldY = targetY * TILE_HEIGHT + TILE_HEIGHT / 2;

		this.tweens.add({
			targets: this.player,
			x: worldX,
			y: worldY,
			duration: 120,
			ease: "Power2",
			onComplete: () => {
				this.isMoving = false;
			},
		});
	}
}
