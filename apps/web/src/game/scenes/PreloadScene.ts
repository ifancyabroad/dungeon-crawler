import Phaser from "phaser";
import { TILE_HEIGHT, TILE_WIDTH, TILESET_KEY } from "../tiles/tilesetRegistry";

export default class PreloadScene extends Phaser.Scene {
	constructor() {
		super("Preload");
	}

	preload() {
		const url = new URL(
			"../../assets/tileset/The Roguelike Remastered 1-6-10 Alpha.png",
			import.meta.url,
		).href;
		// Load as spritesheet so we can use frame indices for hero/monsters and for tilemap
		this.load.spritesheet(TILESET_KEY, url, {
			frameWidth: TILE_WIDTH,
			frameHeight: TILE_HEIGHT,
		});
	}

	create() {
		this.registry.get("onPreloadComplete")?.();
		this.scene.start("Main");
	}
}
