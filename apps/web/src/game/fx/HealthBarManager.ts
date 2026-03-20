import Phaser from "phaser";

const BAR_WIDTH = 28;
const BAR_HEIGHT = 3;
const SHIELD_BAR_HEIGHT = 2;
const BAR_OFFSET_Y = -18; // pixels above sprite center — HP bar baseline
const SHIELD_BAR_GAP = 2; // pixels between HP bar and shield bar
const FADE_DELAY_MS = 3000;
const FADE_DURATION_MS = 400;
const DEPTH = 20;

interface BarEntry {
	gfx: Phaser.GameObjects.Graphics;
	fadeTimer: Phaser.Time.TimerEvent | null;
	fadeTween: Phaser.Tweens.Tween | null;
	lastHp: number;
	lastShieldHp: number;
	sprite: Phaser.GameObjects.Sprite;
}

/**
 * Renders small HP bars above entities. A bar is only shown when HP < maxHP
 * and automatically fades out after FADE_DELAY_MS of no damage, matching DCSS behaviour.
 *
 * Bars reposition every frame via the scene update event to correctly follow
 * sprites that are mid-tween.
 */
export class HealthBarManager {
	private scene: Phaser.Scene;
	private bars = new Map<string, BarEntry>();
	private readonly onUpdate: () => void;

	constructor(scene: Phaser.Scene) {
		this.scene = scene;
		this.onUpdate = () => this.repositionAll();
		scene.events.on("update", this.onUpdate);
	}

	/**
	 * Update or create an HP (and optional shield) bar for an entity.
	 * Call once per turn for every visible living actor.
	 */
	update(
		id: string,
		hp: number,
		maxHp: number,
		sprite: Phaser.GameObjects.Sprite,
		shieldHp = 0,
	): void {
		const fullHp = hp >= maxHp;
		const hasShield = shieldHp > 0;
		let entry = this.bars.get(id);

		if (fullHp && !hasShield && !entry) return;

		if (!entry) {
			entry = this.createEntry(sprite);
			this.bars.set(id, entry);
		}

		entry.sprite = sprite;

		const changed = hp !== entry.lastHp || shieldHp !== entry.lastShieldHp;
		entry.lastHp = hp;
		entry.lastShieldHp = shieldHp;

		if (!fullHp || hasShield) {
			this.drawBar(entry, hp, maxHp, shieldHp);
			entry.gfx.setAlpha(1);
			entry.gfx.setVisible(true);
			if (changed) this.resetFadeTimer(entry);
		} else {
			this.hideBar(entry);
		}
	}

	remove(id: string): void {
		const entry = this.bars.get(id);
		if (entry) {
			this.destroyEntry(entry);
			this.bars.delete(id);
		}
	}

	destroy(): void {
		this.scene.events.off("update", this.onUpdate);
		for (const entry of this.bars.values()) {
			this.destroyEntry(entry);
		}
		this.bars.clear();
	}

	// ------------------------------------------------------------------

	private repositionAll(): void {
		for (const entry of this.bars.values()) {
			if (entry.gfx.visible) {
				entry.gfx.setPosition(
					entry.sprite.x - BAR_WIDTH / 2,
					entry.sprite.y + BAR_OFFSET_Y,
				);
			}
		}
	}

	private createEntry(sprite: Phaser.GameObjects.Sprite): BarEntry {
		const gfx = this.scene.add.graphics();
		gfx.setDepth(DEPTH);
		gfx.setVisible(false);
		return { gfx, fadeTimer: null, fadeTween: null, lastHp: -1, lastShieldHp: 0, sprite };
	}

	private drawBar(entry: BarEntry, hp: number, maxHp: number, shieldHp = 0): void {
		const pct = Math.max(0, Math.min(1, hp / maxHp));
		entry.gfx.clear();

		// HP bar
		entry.gfx.fillStyle(0x000000, 0.7);
		entry.gfx.fillRect(0, 0, BAR_WIDTH, BAR_HEIGHT);
		entry.gfx.fillStyle(this.hpColor(pct), 1);
		entry.gfx.fillRect(0, 0, Math.round(BAR_WIDTH * pct), BAR_HEIGHT);

		// Shield bar (drawn above the HP bar when shieldHp > 0)
		if (shieldHp > 0) {
			const shieldY = -(SHIELD_BAR_HEIGHT + SHIELD_BAR_GAP);
			const SHIELD_MAX_DISPLAY = 20; // matches the grant amount in shield.json
			const shieldPct = Math.min(1, shieldHp / SHIELD_MAX_DISPLAY);
			entry.gfx.fillStyle(0x000000, 0.7);
			entry.gfx.fillRect(0, shieldY, BAR_WIDTH, SHIELD_BAR_HEIGHT);
			entry.gfx.fillStyle(0x44aaff, 1);
			entry.gfx.fillRect(0, shieldY, Math.round(BAR_WIDTH * shieldPct), SHIELD_BAR_HEIGHT);
		}
	}

	private hpColor(pct: number): number {
		if (pct > 0.6) return 0x44cc44;
		if (pct > 0.3) return 0xffcc00;
		return 0xff3333;
	}

	private resetFadeTimer(entry: BarEntry): void {
		entry.fadeTimer?.remove(false);
		entry.fadeTween?.stop();
		entry.gfx.setAlpha(1);

		entry.fadeTimer = this.scene.time.delayedCall(FADE_DELAY_MS, () => {
			entry.fadeTween = this.scene.tweens.add({
				targets: entry.gfx,
				alpha: 0,
				duration: FADE_DURATION_MS,
				ease: "Linear",
				onComplete: () => entry.gfx.setVisible(false),
			});
		});
	}

	private hideBar(entry: BarEntry): void {
		entry.fadeTimer?.remove(false);
		entry.fadeTween?.stop();
		entry.gfx.setVisible(false);
	}

	private destroyEntry(entry: BarEntry): void {
		entry.fadeTimer?.remove(false);
		entry.fadeTween?.stop();
		entry.gfx.destroy();
	}
}
