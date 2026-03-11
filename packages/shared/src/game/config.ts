/** Game-wide configuration constants. Easy to adjust in one place. */

/** Default hero vision radius in tiles (Euclidean distance). */
export const VISION_RADIUS = 8;

/**
 * XP required to reach each level (D&D 5e table).
 * Index = target level. Index 0 is unused; index 1 = 0 XP (starting level).
 */
export const XP_PER_LEVEL: readonly number[] = [
	0, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000,
	165000, 195000, 225000, 265000, 305000, 355000,
];
