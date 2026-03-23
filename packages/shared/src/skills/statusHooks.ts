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
	/** Deals `effect.value` fire damage per turn. Add to DOT_EFFECT_IDS. */
	BURNING: "burning",
	/** Deals `effect.value` piercing damage per turn. Add to DOT_EFFECT_IDS. */
	BLEEDING: "bleeding",
	/** Heals `effect.value` HP per turn. Processed in tickActiveEffects via HEAL_EFFECT_IDS. */
	REGENERATING: "regenerating",
	/** Actor cannot act. Hero move/attack/use_skill returns hero_stunned; monster AI is skipped. */
	STUNNED: "stunned",
	/**
	 * Temporarily flips the actor's effective faction to "player" for one turn.
	 * Processed in processEnemyTurns — charmed monsters run runAllyAI targeting hostiles.
	 * Stored faction on the actor is never mutated.
	 */
	CHARMED: "charmed",
	/**
	 * Overrides the monster's AI strategy to "frightened" for the duration.
	 * Processed in processEnemyTurns — frightened monsters flee from the hero.
	 */
	FRIGHTENED: "frightened",
} as const;
