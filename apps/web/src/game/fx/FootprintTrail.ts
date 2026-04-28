import Phaser from "phaser";
import { TILE_HEIGHT, TILE_WIDTH } from "../tiles/tilesetRegistry";

const FOOTPRINT_ALPHA = 0.4;
const FOOTPRINT_FADE_MS = 1500;
/** Radius of each individual foot mark. */
const FOOT_RADIUS = 2;
/** How far each mark sits left/right of the tile centre, perpendicular to movement. */
const FOOT_OFFSET = 3;
/** How far the leading foot is ahead of centre along the movement direction. */
const STEP_STAGGER = 2;

/**
 * Renders a brief fading two-footprint trail at each tile the hero passed through during
 * instant travel. Each tile gets one mark for the left foot and one for the right, with the
 * leading foot alternating to produce a natural walking-gait pattern.
 */
export class FootprintTrail {
	private scene: Phaser.Scene;

	constructor(scene: Phaser.Scene) {
		this.scene = scene;
	}

	show(tiles: { x: number; y: number }[]): void {
		for (let i = 0; i < tiles.length; i++) {
			const tile = tiles[i];
			const cx = tile.x * TILE_WIDTH + TILE_WIDTH / 2;
			const cy = tile.y * TILE_HEIGHT + TILE_HEIGHT / 2;

			// Infer movement direction from neighbouring positions in the path.
			const next = tiles[i + 1];
			const prev = tiles[i - 1];
			const dx = next ? next.x - tile.x : prev ? tile.x - prev.x : 1;
			const dy = next ? next.y - tile.y : prev ? tile.y - prev.y : 0;
			const len = Math.sqrt(dx * dx + dy * dy) || 1;

			// Normalised forward vector and its left-perpendicular.
			const fwX = dx / len;
			const fwY = dy / len;
			const lpX = -fwY; // 90° left of forward
			const lpY = fwX;

			// Alternate which foot is ahead each step.
			const leftAhead = i % 2 === 0;
			const stagger = leftAhead ? STEP_STAGGER : -STEP_STAGGER;

			// Left foot: left of centre, staggered forward or back.
			this.spawnMark(
				cx + lpX * FOOT_OFFSET + fwX * stagger,
				cy + lpY * FOOT_OFFSET + fwY * stagger,
			);
			// Right foot: right of centre, staggered the opposite way.
			this.spawnMark(
				cx - lpX * FOOT_OFFSET - fwX * stagger,
				cy - lpY * FOOT_OFFSET - fwY * stagger,
			);
		}
	}

	private spawnMark(px: number, py: number): void {
		const g = this.scene.add.graphics();
		g.fillStyle(0xffffff, FOOTPRINT_ALPHA);
		g.fillCircle(0, 0, FOOT_RADIUS);
		g.setPosition(px, py);
		g.setDepth(8);
		this.scene.tweens.add({
			targets: g,
			alpha: 0,
			duration: FOOTPRINT_FADE_MS,
			ease: "Linear",
			onComplete: () => g.destroy(),
		});
	}
}
