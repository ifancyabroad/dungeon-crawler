import Phaser from "phaser";
import MainScene from "./scenes/MainScene";

export function createGame(parent: HTMLElement) {
	return new Phaser.Game({
		type: Phaser.AUTO,
		parent,
		width: 800,
		height: 600,
		scene: [MainScene],
		scale: {
			mode: Phaser.Scale.RESIZE,
			autoCenter: Phaser.Scale.NO_CENTER,
		},
	});
}
