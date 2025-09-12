import Phaser from "phaser";
import MainScene from "./scenes/MainScene";

export type GameSize = { width: number; height: number };

export function createGame(parent: HTMLElement, size: GameSize = { width: 800, height: 600 }) {
	return new Phaser.Game({
		type: Phaser.AUTO,
		parent,
		width: size.width,
		height: size.height,
		backgroundColor: "#0b1220",
		scene: [MainScene],
		scale: {
			mode: Phaser.Scale.NONE,
			autoCenter: Phaser.Scale.NO_CENTER,
		},
	});
}
