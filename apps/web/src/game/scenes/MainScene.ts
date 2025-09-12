import Phaser from "phaser";

export default class MainScene extends Phaser.Scene {
	private stars: Phaser.GameObjects.Rectangle[] = [];

	constructor() {
		super("Main");
	}

	create() {
		const { width: w, height: h } = this.scale;

		this.add
			.text(w / 2, 300, "Phaser + React 🎮", { fontSize: "28px", color: "#e2e8f0" })
			.setOrigin(0.5);

		const STAR_COUNT = 120;

		for (let i = 0; i < STAR_COUNT; i++) {
			const x = Phaser.Math.Between(0, w);
			const y = Phaser.Math.Between(0, h);
			const size = Phaser.Math.FloatBetween(1, 2.5);
			const alpha = Phaser.Math.FloatBetween(0.3, 1);

			const star = this.add.rectangle(x, y, size, size, 0xffffff).setAlpha(alpha);

			this.stars.push(star);
		}
	}

	update(_time: number, delta: number) {
		const { width: w, height: h } = this.scale;

		for (let i = 0; i < this.stars.length; i++) {
			const star = this.stars[i];
			const speed = i % 7 === 0 ? 140 : i % 3 === 0 ? 80 : 40;
			star.y += (speed * delta) / 1000;

			if (star.y > h + 2) {
				star.y = -2;
				star.x = Phaser.Math.Between(0, w);
			}
		}
	}
}
