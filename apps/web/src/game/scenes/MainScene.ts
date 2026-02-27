import Phaser from "phaser";
import {
	buildGroundLayer,
	buildWallLayer,
	DEFAULT_MAP_HEIGHT,
	DEFAULT_MAP_WIDTH,
	TILE_TYPE,
} from "@app/shared";
import {
	COLLIDING_INDICES,
	ENTITIES,
	TILE_HEIGHT,
	TILE_WIDTH,
	TILESET_KEY,
	TERRAIN,
} from "../tilesetRegistry";

const MAP_WIDTH = DEFAULT_MAP_WIDTH;
const MAP_HEIGHT = DEFAULT_MAP_HEIGHT;

/** Map shared layer data (logical tile types) to tileset indices for Phaser. */
function toGroundTileIndices(layer: number[][]): number[][] {
	const floorIndex = TERRAIN.FLOOR[0];
	return layer.map((row) => row.map(() => floorIndex));
}

function toWallTileIndices(layer: number[][]): number[][] {
	const wallIndex = TERRAIN.WALL[0];
	return layer.map((row) =>
		row.map((cell) => (cell === TILE_TYPE.WALL ? wallIndex : TILE_TYPE.EMPTY)),
	);
}

export default class MainScene extends Phaser.Scene {
	private groundLayer: Phaser.Tilemaps.TilemapLayer | null = null;
	private wallLayer: Phaser.Tilemaps.TilemapLayer | null = null;
	private player!: Phaser.GameObjects.Sprite;
	private playerTileX = 0;
	private playerTileY = 0;
	private isMoving = false;

	constructor() {
		super("Main");
	}

	create() {
		const groundData = toGroundTileIndices(buildGroundLayer(MAP_WIDTH, MAP_HEIGHT));
		const wallData = toWallTileIndices(buildWallLayer(MAP_WIDTH, MAP_HEIGHT));

		// Ground: one tilemap from data, one layer
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

		// Walls: second tilemap so we can use -1 for empty; create layer from wall data
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

		// Collision: walls block movement. setCollision is on the map, not the layer.
		wallMap.setCollision(COLLIDING_INDICES);

		// Player: sprite from tileset using ENTITIES.HERO frame (one tile per move)
		this.playerTileX = MAP_WIDTH >> 1;
		this.playerTileY = MAP_HEIGHT >> 1;
		const startX = this.playerTileX * TILE_WIDTH + TILE_WIDTH / 2;
		const startY = this.playerTileY * TILE_HEIGHT + TILE_HEIGHT / 2;
		this.player = this.add.sprite(startX, startY, TILESET_KEY, ENTITIES.HERO);
		this.player.setOrigin(0.5, 0.5);

		// Camera: center on player (DCSS / ToME style), bounds clamped to map
		this.cameras.main.setBounds(0, 0, MAP_WIDTH * TILE_WIDTH, MAP_HEIGHT * TILE_HEIGHT);
		this.cameras.main.startFollow(this.player, true);

		this.input.keyboard?.on("keydown-W", () => this.tryMove(0, -1));
		this.input.keyboard?.on("keydown-S", () => this.tryMove(0, 1));
		this.input.keyboard?.on("keydown-A", () => this.tryMove(-1, 0));
		this.input.keyboard?.on("keydown-D", () => this.tryMove(1, 0));
	}

	/** Returns true if (tileX, tileY) is walkable (in bounds and not a wall). */
	private isWalkable(tileX: number, tileY: number): boolean {
		if (tileX < 0 || tileX >= MAP_WIDTH || tileY < 0 || tileY >= MAP_HEIGHT) return false;
		if (!this.wallLayer) return true;
		const tile = this.wallLayer.getTileAt(tileX, tileY);
		if (!tile) return true;
		// -1 or empty means no wall; otherwise check collision list
		if (tile.index === -1) return true;
		return !COLLIDING_INDICES.includes(tile.index);
	}

	/** Move player one tile in direction (dx, dy) if the cell is walkable. */
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
