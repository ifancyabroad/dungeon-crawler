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
	 */
	newHeroTilePos?: { x: number; y: number };
}

/** All data a handler needs to decide what to animate and when to dispatch FX. */
export interface SkillAnimContext {
	event: Extract<GameEvent, { type: "skill_used" }>;
	heroSprite: Phaser.GameObjects.Sprite;
	/** Hero's tile index in the authoritative state after the action completed. */
	heroIdxAfter: number;
	/** Whether the hero's tile position changed as a result of this skill. */
	heroMoved: boolean;
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
