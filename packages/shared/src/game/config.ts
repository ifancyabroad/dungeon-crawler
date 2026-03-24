/** Game-wide configuration constants. Easy to adjust in one place. */

/** Default hero vision radius in tiles (Euclidean distance). */
export const VISION_RADIUS = 8;

/** Base number of NPCs to spawn per floor. Scales with floor depth. */
export const BASE_NPCS_PER_FLOOR = 5;

/**
 * XP required to reach each level.
 * Index = target level. Index 0 is unused; index 1 = 0 XP (starting level).
 *
 * Values are intentionally low for rapid testing of the skill system.
 * Raise these once content/balancing is ready for production.
 */
export const XP_PER_LEVEL: readonly number[] = [
	0, 0, 50, 120, 220, 350, 520, 740, 1020, 1380, 1840, 2420, 3140, 4020, 5080, 6340, 7840, 9600,
	11650, 14020, 16750,
];
