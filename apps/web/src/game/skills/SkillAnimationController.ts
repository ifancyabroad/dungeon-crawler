/**
 * SkillAnimationController — dispatches per-skill animations via a registry.
 *
 * Two entry points:
 *   handle()          — plays one skill animation for a known caster sprite. Called
 *                       directly by MainScene for hero skills, where the result determines
 *                       whether the entire FX pipeline should be deferred.
 *   dispatchNonHero() — iterates all non-hero skill_used events in a turn, resolves
 *                       caster sprites, plays animations, and returns the set of events
 *                       whose damage numbers are owned by the animation system.
 *                       Called from inside dispatchFxAndSync so other FX (attack bumps,
 *                       deaths) are unaffected by non-hero skill timing.
 *
 * Adding a new skill animation requires only a new entry in SKILL_ANIM_REGISTRY;
 * no changes to this file or MainScene are needed.
 *
 * The controller is actor-agnostic: it works identically for hero and non-hero actors.
 */

import type Phaser from "phaser";
import { idxToXY, isSkillDamageEvent } from "@app/shared";
import type { GameEvent, SkillDamageEvent } from "@app/shared";
import { SKILL_ANIM_REGISTRY, DEFAULT_ANIM_RESULT } from "../fx/skills";
import type { SkillAnimResult } from "../fx/skills";
import { TILE_WIDTH, TILE_HEIGHT } from "../tiles/tilesetRegistry";

export type { SkillAnimResult };

export class SkillAnimationController {
	private scene: Phaser.Scene;
	private mapWidth: number;

	constructor(scene: Phaser.Scene, mapWidth: number) {
		this.scene = scene;
		this.mapWidth = mapWidth;
	}

	updateMapWidth(mapWidth: number): void {
		this.mapWidth = mapWidth;
	}

	/**
	 * Attempt to play the animation for a single `skill_used` event.
	 * Returns a result describing how the caller should handle FX dispatch timing.
	 * If no handler is registered for the skill, returns `{ handled: false }`.
	 *
	 * @param casterSprite  - The sprite of the actor casting the skill.
	 * @param casterIdxAfter - The caster's tile index after the action resolved.
	 * @param casterMoved   - Whether the caster's tile position changed this turn.
	 * @param onImpact      - Callback invoked by the handler when deferred FX should fire.
	 */
	handle(
		event: Extract<GameEvent, { type: "skill_used" }>,
		casterSprite: Phaser.GameObjects.Sprite,
		casterIdxAfter: number,
		casterMoved: boolean,
		onImpact: () => void,
	): SkillAnimResult {
		const handler = SKILL_ANIM_REGISTRY[event.skillId];
		if (!handler) return DEFAULT_ANIM_RESULT;

		// Derive cast-time pixel position from the snapshotted tile index in the event.
		// This must come from the event, not the store — by animation time the store
		// already reflects post-turn actor positions.
		let targetWorldPos: { px: number; py: number } | undefined;
		if (event.targetActorIdx !== undefined) {
			const { x, y } = idxToXY(event.targetActorIdx, this.mapWidth);
			targetWorldPos = {
				px: x * TILE_WIDTH + TILE_WIDTH / 2,
				py: y * TILE_HEIGHT + TILE_HEIGHT / 2,
			};
		}

		return handler(
			{ event, casterSprite, casterIdxAfter, casterMoved, targetWorldPos, onImpact },
			this.scene,
			this.mapWidth,
		);
	}

	/**
	 * Plays skill animations for all non-hero actors that used a skill this turn.
	 *
	 * Returns the set of events claimed by an animation — i.e. events whose damage
	 * numbers will be shown via an onImpact callback rather than the caller's main
	 * damage-numbers pass. The caller should exclude these from its own handleEvents
	 * call to avoid double-counting.
	 *
	 * All handled casters are included regardless of fxDeferred:
	 *   - Ranged skills: onImpact fires at projectile impact.
	 *   - Contact skills: onImpact fires immediately, but the events are still claimed
	 *     so the main pass doesn't show the numbers a second time.
	 *
	 * @param events       - All game events for this turn.
	 * @param heroId       - Used to filter out the hero's own skill events.
	 * @param getSprite    - Resolves an actor ID to its Phaser sprite (if visible).
	 * @param getCasterIdx - Resolves an actor ID to its current tile index.
	 * @param showDamage   - Callback that displays damage numbers for a subset of events.
	 */
	dispatchNonHero(
		events: GameEvent[],
		heroId: string,
		getSprite: (id: string) => Phaser.GameObjects.Sprite | undefined,
		getCasterIdx: (id: string) => number | undefined,
		showDamage: (events: GameEvent[]) => void,
	): Set<GameEvent> {
		const claimedEvents = new Set<GameEvent>();

		const nonHeroSkillEvents = events.filter(
			(e): e is Extract<GameEvent, { type: "skill_used" }> =>
				e.type === "skill_used" && e.actorId !== heroId,
		);

		for (const skillEvent of nonHeroSkillEvents) {
			const casterId = skillEvent.actorId;
			const casterSprite = getSprite(casterId);
			if (!casterSprite) continue;

			const casterIdxAfter = getCasterIdx(casterId) ?? 0;

			// Collect the events this animation will handle so they can be excluded
			// from the caller's main damage-numbers pass.
			const ownEvents = events.filter(
				(e): e is SkillDamageEvent => isSkillDamageEvent(e) && e.attackerId === casterId,
			);
			const onImpact = () => showDamage(ownEvents);

			const animResult = this.handle(
				skillEvent,
				casterSprite,
				casterIdxAfter,
				false,
				onImpact,
			);

			if (animResult.handled) {
				for (const e of ownEvents) claimedEvents.add(e);
			}
		}

		return claimedEvents;
	}
}
