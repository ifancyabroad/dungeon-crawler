import Phaser from "phaser";

export const BLOOD_TEXTURE_KEY = "__blood_particle__";

/** Default blood colour used for the hero. */
export const HERO_BLOOD_COLOR = "#cc0000";

/** Default red blood tints used for the hero and any NPC without a bloodColor. */
export const DEFAULT_BLOOD_TINTS: number[] = [0xcc0000, 0x8b0000, 0x6b0000, 0xff2222];

/**
 * Ensures the shared blood particle texture exists in the scene's texture cache.
 * Safe to call multiple times — creates the texture only once.
 */
export function ensureBloodTexture(scene: Phaser.Scene): void {
	if (scene.textures.exists(BLOOD_TEXTURE_KEY)) return;
	const gfx = scene.make.graphics({ x: 0, y: 0 });
	gfx.fillStyle(0xffffff, 1);
	gfx.fillRect(0, 0, 3, 3);
	gfx.generateTexture(BLOOD_TEXTURE_KEY, 3, 3);
	gfx.destroy();
}

/**
 * Convert a CSS hex colour string (e.g. "#cc0000") to a Phaser-compatible number.
 */
export function hexToNumber(hex: string): number {
	return parseInt(hex.replace("#", ""), 16);
}

/**
 * Derive a 4-colour tint palette from a single base colour by applying
 * fixed brightness offsets (darker variant, medium, lighter, original).
 */
export function bloodTintsFromColor(hex: string): number[] {
	const base = hexToNumber(hex);
	const r = (base >> 16) & 0xff;
	const g = (base >> 8) & 0xff;
	const b = base & 0xff;

	const scale = (factor: number) =>
		(Math.min(255, Math.round(r * factor)) << 16) |
		(Math.min(255, Math.round(g * factor)) << 8) |
		Math.min(255, Math.round(b * factor));

	return [
		scale(1.0), // base
		scale(0.6), // dark
		scale(0.45), // darkest
		scale(1.2), // bright
	];
}
