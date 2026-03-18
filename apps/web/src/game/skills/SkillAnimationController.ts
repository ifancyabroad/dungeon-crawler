/**
 * SkillAnimationController — dispatches per-skill animations via a registry.
 *
 * MainScene calls `handle()` once per turn that contained a `skill_used` event.
 * The controller looks up the registered handler for that skill ID and delegates.
 * Adding a new skill animation requires only a new entry in SKILL_ANIM_REGISTRY;
 * no changes to MainScene or this file are needed.
 */

import type Phaser from "phaser";
import type { GameEvent } from "@app/shared";
import { SKILL_ANIM_REGISTRY, DEFAULT_ANIM_RESULT } from "../fx/skills";
import type { SkillAnimResult } from "../fx/skills";

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
	 * Attempt to play the animation for the given `skill_used` event.
	 * Returns a result describing how MainScene should handle hero sprite sync and FX dispatch.
	 * If no handler is registered for the skill, returns `{ handled: false }`.
	 */
	handle(
		event: Extract<GameEvent, { type: "skill_used" }>,
		heroSprite: Phaser.GameObjects.Sprite,
		heroIdxAfter: number,
		heroMoved: boolean,
		onImpact: () => void,
	): SkillAnimResult {
		const handler = SKILL_ANIM_REGISTRY[event.skillId];
		if (!handler) return DEFAULT_ANIM_RESULT;
		return handler(
			{ event, heroSprite, heroIdxAfter, heroMoved, onImpact },
			this.scene,
			this.mapWidth,
		);
	}
}
