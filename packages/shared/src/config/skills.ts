/**
 * Skill-system literals — defaults and status hook ids.
 */

export const STATUS_HOOKS = {
	/** Deals `effect.value` damage per turn. Processed in tickActiveEffects. */
	POISONED: "poisoned",
	/** Hides the hero. On expiry, alerts all NPCs to the hero's position. */
	STEALTH: "stealth",
	/** Deals `effect.value` fire damage per turn. Add to DOT_EFFECT_IDS. */
	BURNING: "burning",
	/** Deals `effect.value` piercing damage per turn. Add to DOT_EFFECT_IDS. */
	BLEEDING: "bleeding",
	/** Heals `effect.value` HP per turn. Processed in tickActiveEffects via HEAL_EFFECT_IDS. */
	REGENERATING: "regenerating",
	/** Actor cannot act. Hero move/attack/use_skill returns hero_stunned; NPC AI is skipped. */
	STUNNED: "stunned",
	/**
	 * Temporarily flips the actor's effective faction to "player" for one turn.
	 * Processed in processEnemyTurns — charmed NPCs run ally AI targeting hostiles.
	 * Stored faction on the actor is never mutated.
	 */
	CHARMED: "charmed",
	/**
	 * Overrides the NPC's AI strategy to "frightened" for the duration.
	 * Processed in processEnemyTurns — frightened NPCs flee from the hero.
	 */
	FRIGHTENED: "frightened",
	/**
	 * Prevents the actor from using active skills for the duration.
	 * Hero: use_skill is rejected with "hero_silenced". NPC: skill branch is skipped.
	 */
	SILENCED: "silenced",
	/**
	 * Prevents the actor from moving for the duration (can still attack and use skills).
	 * Hero: move is rejected with "hero_rooted". NPC: move result is treated as idle.
	 */
	ROOTED: "rooted",
	/**
	 * Strips the concealment benefit of stealth without removing the stealth effect.
	 * NPCs can see the hero normally while revealed is active.
	 * Optionally prevents re-applying stealth until the effect expires.
	 */
	REVEALED: "revealed",
} as const;

export const SKILLS_CONFIG = {
	defaults: {
		coneAngleDegrees: 90,
		saveSuccessDamageMultiplier: 0.5,
	},
	statusHooks: STATUS_HOOKS,
} as const;
