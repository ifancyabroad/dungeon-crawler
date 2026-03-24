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
} as const;

export const SKILLS_CONFIG = {
	defaults: {
		coneAngleDegrees: 90,
		saveSuccessDamageMultiplier: 0.5,
	},
	statusHooks: STATUS_HOOKS,
} as const;
