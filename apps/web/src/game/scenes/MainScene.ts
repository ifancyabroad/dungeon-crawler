import Phaser from "phaser";
import { useGameStore } from "../../stores/gameStore";

const TARGET_COLORS = [0xff6b6b, 0x4ecdc4, 0xffe66d, 0x95e1d3, 0xf38181];
const TARGET_SPAWN_INTERVAL = 800; // ms between spawns
const TARGET_LIFETIME = 2000; // ms before target disappears
const POINTS_PER_TARGET = 10;

export default class MainScene extends Phaser.Scene {
	private stars: Phaser.GameObjects.Rectangle[] = [];
	private targets: Phaser.GameObjects.Arc[] = [];
	private spawnTimer?: Phaser.Time.TimerEvent;
	private countdownTimer?: Phaser.Time.TimerEvent;
	private unsubscribe?: () => void;
	private wasPlaying = false;

	constructor() {
		super("Main");
	}

	create() {
		this.createStarfield();
		this.setupStoreSubscription();
	}

	private createStarfield() {
		const { width: w, height: h } = this.scale;
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

	private setupStoreSubscription() {
		// Subscribe to store changes
		this.unsubscribe = useGameStore.subscribe((state) => {
			if (state.isPlaying && !this.wasPlaying) {
				this.onGameStart();
			} else if (!state.isPlaying && this.wasPlaying) {
				this.onGameEnd();
			}
			this.wasPlaying = state.isPlaying;
		});

		// Check initial state
		this.wasPlaying = useGameStore.getState().isPlaying;
	}

	private onGameStart() {
		this.clearTargets();

		// Start spawning targets
		this.spawnTimer = this.time.addEvent({
			delay: TARGET_SPAWN_INTERVAL,
			callback: this.spawnTarget,
			callbackScope: this,
			loop: true,
		});

		// Start countdown timer
		this.countdownTimer = this.time.addEvent({
			delay: 1000,
			callback: this.tickTimer,
			callbackScope: this,
			loop: true,
		});
	}

	private onGameEnd() {
		this.spawnTimer?.destroy();
		this.countdownTimer?.destroy();
		this.clearTargets();
	}

	private tickTimer() {
		const { timeLeft, endGame, setTimeLeft } = useGameStore.getState();
		if (timeLeft <= 0) {
			endGame();
		} else {
			setTimeLeft(timeLeft - 1);
		}
	}

	private spawnTarget() {
		const { width: w, height: h } = this.scale;
		const padding = 50;
		const x = Phaser.Math.Between(padding, w - padding);
		const y = Phaser.Math.Between(padding, h - padding);
		const radius = Phaser.Math.Between(20, 35);
		const color = Phaser.Math.RND.pick(TARGET_COLORS);

		const target = this.add.circle(x, y, radius, color);
		target.setInteractive({ useHandCursor: true });
		target.setAlpha(0);

		// Fade in
		this.tweens.add({
			targets: target,
			alpha: 1,
			scale: { from: 0.5, to: 1 },
			duration: 150,
			ease: "Back.easeOut",
		});

		// Click handler
		target.on("pointerdown", () => this.onTargetClick(target));

		this.targets.push(target);

		// Auto-remove after lifetime
		this.time.delayedCall(TARGET_LIFETIME, () => {
			this.removeTarget(target, false);
		});
	}

	private onTargetClick(target: Phaser.GameObjects.Arc) {
		if (!useGameStore.getState().isPlaying) return;

		useGameStore.getState().addPoints(POINTS_PER_TARGET);
		this.removeTarget(target, true);
	}

	private removeTarget(target: Phaser.GameObjects.Arc, wasClicked: boolean) {
		const index = this.targets.indexOf(target);
		if (index === -1) return;

		this.targets.splice(index, 1);

		if (wasClicked) {
			// Pop effect when clicked
			this.tweens.add({
				targets: target,
				scale: 1.5,
				alpha: 0,
				duration: 100,
				onComplete: () => target.destroy(),
			});
		} else {
			// Fade out when expired
			this.tweens.add({
				targets: target,
				alpha: 0,
				duration: 200,
				onComplete: () => target.destroy(),
			});
		}
	}

	private clearTargets() {
		this.targets.forEach((t) => t.destroy());
		this.targets = [];
	}

	update(_time: number, delta: number) {
		// Animate starfield
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

	shutdown() {
		this.unsubscribe?.();
	}
}
