import Phaser from "phaser";
import {
	computeOpacityMask,
	idxToXY,
	MAP_GEN_VERSION,
	regenerateBaseMaps,
	type FloorConfig,
} from "@app/shared";
import { vaults } from "@app/content";
import {
	TILE_HEIGHT,
	TILE_WIDTH,
	TILESET_KEY,
	getExitTile,
	getHeroTile,
} from "../../tiles/tilesetRegistry";
import {
	decorationGridToTileIndices,
	toGroundTileIndices,
	toWallTileIndices,
} from "../../tiles/mapTileMapping";

export interface BuildMapVisualsParams {
	scene: Phaser.Scene;
	config: FloorConfig & { seed: number };
	heroPos: { floorIndex: number; idx: number; classId: string };
	exitIdx: number | null;
}

export interface BuildMapVisualsResult {
	groundLayer: Phaser.Tilemaps.TilemapLayer | null;
	wallLayer: Phaser.Tilemaps.TilemapLayer | null;
	decorationLayer: Phaser.Tilemaps.TilemapLayer | null;
	player: Phaser.GameObjects.Sprite;
	playerTileX: number;
	playerTileY: number;
	opacityMask: Uint8Array;
	exitSprite: Phaser.GameObjects.Sprite | null;
}

export function buildMapVisuals(params: BuildMapVisualsParams): BuildMapVisualsResult {
	const { scene, config, heroPos, exitIdx } = params;

	// Run the full single-floor pipeline via shared — identical stages and order to the server.
	const [base] = regenerateBaseMaps(config.seed, [config], MAP_GEN_VERSION, {
		vaultDefs: vaults,
	});
	const { ground, wall, waterMask, decorationGrid, vaultPlacements } = base;

	const groundData = toGroundTileIndices(ground, wall, waterMask, config.theme, config.seed);
	const wallData = toWallTileIndices(wall, config.theme, config.seed);
	const decorationData = decorationGridToTileIndices(decorationGrid, config.theme, config.seed);

	// Bake vault tile overrides into layer data before tilemaps are created.
	for (const placement of vaultPlacements) {
		applyOverrides(groundData, placement.groundOverrides, config.width);
		applyOverrides(wallData, placement.wallOverrides, config.width);
		applyOverrides(decorationData, placement.decorationOverrides, config.width);
	}

	const groundLayer = createLayer(scene, groundData, null);
	const decorationLayer = createLayer(scene, decorationData, 1);
	const wallLayer = createLayer(scene, wallData, null);

	const opacityMask = computeOpacityMask(wall, config.width, config.height);

	const exitSprite = createExitSprite(scene, exitIdx, config);
	const { player, playerTileX, playerTileY } = createHeroSprite(scene, heroPos, config);

	return {
		groundLayer,
		wallLayer,
		decorationLayer,
		player,
		playerTileX,
		playerTileY,
		opacityMask,
		exitSprite,
	};
}

function applyOverrides(
	layerData: number[][],
	overrides: Record<string, number>,
	width: number,
): void {
	for (const [flatIdxStr, tileId] of Object.entries(overrides)) {
		const flatIdx = Number(flatIdxStr);
		const x = flatIdx % width;
		const y = Math.floor(flatIdx / width);
		if (layerData[y]) layerData[y][x] = tileId;
	}
}

function createLayer(
	scene: Phaser.Scene,
	data: number[][],
	depth: number | null,
): Phaser.Tilemaps.TilemapLayer | null {
	const map = scene.make.tilemap({ data, tileWidth: TILE_WIDTH, tileHeight: TILE_HEIGHT });
	const tileset = map.addTilesetImage(TILESET_KEY);
	if (!tileset) return null;
	const layer = map.createLayer(0, tileset, 0, 0);
	if (!layer) return null;
	if (depth !== null) layer.setDepth(depth);
	return layer;
}

function createExitSprite(
	scene: Phaser.Scene,
	exitIdx: number | null,
	config: FloorConfig,
): Phaser.GameObjects.Sprite | null {
	if (exitIdx === null) return null;
	const { x: ex, y: ey } = idxToXY(exitIdx, config.width);
	const exitSprite = scene.add.sprite(
		ex * TILE_WIDTH + TILE_WIDTH / 2,
		ey * TILE_HEIGHT + TILE_HEIGHT / 2,
		TILESET_KEY,
		getExitTile(config.theme),
	);
	exitSprite.setOrigin(0.5, 0.5);
	exitSprite.setDepth(2);
	exitSprite.setAlpha(0);
	return exitSprite;
}

function createHeroSprite(
	scene: Phaser.Scene,
	heroPos: { idx: number; classId: string },
	config: FloorConfig,
): {
	player: Phaser.GameObjects.Sprite;
	playerTileX: number;
	playerTileY: number;
} {
	const spawnPos = idxToXY(heroPos.idx, config.width);
	const playerTileX = spawnPos.x;
	const playerTileY = spawnPos.y;
	const startX = playerTileX * TILE_WIDTH + TILE_WIDTH / 2;
	const startY = playerTileY * TILE_HEIGHT + TILE_HEIGHT / 2;
	const player = scene.add.sprite(startX, startY, TILESET_KEY, getHeroTile(heroPos.classId));
	player.setOrigin(0.5, 0.5);
	player.setDepth(10);

	return { player, playerTileX, playerTileY };
}
