import type Phaser from "phaser";
import type { GameEvent } from "@app/shared";

/** Result returned by a skill animation handler. */
export interface SkillAnimResult {
	/** Whether this handler recognised and handled the skill. */
	handled: boolean;
	/**
	 * When true, the caller must NOT dispatch FX (deaths, damage numbers, monster sync)
	 * immediately — the handler's `onImpact` callback will do it at the right moment.
	 */
	fxDeferred: boolean;
	/**
	 * Set when the handler moved the hero sprite. Caller should update its tile
	 * position tracker (playerTileX / playerTileY) to these values so LoS is correct.
	 * Only populated for hero-cast movement skills; ignored for monster skills.
	 */
	newHeroTilePos?: { x: number; y: number };
}

/** All data a handler needs to decide what to animate and when to dispatch FX. */
export interface SkillAnimContext {
	event: Extract<GameEvent, { type: "skill_used" }>;
	/** The sprite of the actor casting the skill (hero or monster). */
	casterSprite: Phaser.GameObjects.Sprite;
	/** The caster's tile index in the authoritative state after the action completed. */
	casterIdxAfter: number;
	/** Whether the caster's tile position changed as a result of this skill. */
	casterMoved: boolean;
	/**
	 * World-pixel centre of the target actor at the moment of casting, derived from
	 * `event.targetActorIdx` (snapshotted before enemy turns move actors).
	 * Present only when the skill targeted a specific actor.
	 *
	 * Handlers MUST use this instead of reading the store — the store reflects
	 * post-turn positions, so projectiles would fly to the wrong tile otherwise.
	 */
	targetWorldPos?: { px: number; py: number };
	/**
	 * Call this to trigger deferred FX dispatch (deaths, damage numbers, monster sync).
	 * Handlers that set `fxDeferred: true` MUST call this at the appropriate moment.
	 */
	onImpact: () => void;
}

/**
 * A handler function registered in the skill animation registry.
 * Adding a new skill animation = implement this signature and register it.
 */
export type SkillAnimHandlerFn = (
	ctx: SkillAnimContext,
	scene: Phaser.Scene,
	mapWidth: number,
) => SkillAnimResult;

export const DEFAULT_ANIM_RESULT: SkillAnimResult = {
	handled: false,
	fxDeferred: false,
};
