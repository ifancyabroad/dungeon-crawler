/**
 * Registry of all status effect IDs that require engine-wired hooks.
 *
 * Add an entry here when a status needs to DO something at a specific
 * lifecycle moment (per-tick, on-expiry, etc.) rather than just modify a
 * number that gets read at resolution time.
 *
 * Data-driven statuses (numeric modifiers only) are NOT listed here —
 * their modifiers are defined inline in the skill JSON.
 */
export const STATUS_HOOKS = {
	/** Deals `effect.value` damage per turn. Processed in tickActiveEffects. */
	POISONED: "poisoned",
	/** Hides the hero. On expiry, alerts all monsters to the hero's position. */
	STEALTH: "stealth",
} as const;
