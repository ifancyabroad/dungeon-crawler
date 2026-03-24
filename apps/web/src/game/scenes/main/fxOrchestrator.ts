import type Phaser from "phaser";
import { npcsById } from "@app/content";
import type { FloorState, GameEvent, GameState } from "@app/shared";
import type { AttackAnimator } from "../../fx/AttackAnimator";
import type { DamageNumberManager } from "../../fx/DamageNumberManager";
import type { DeathFxManager } from "../../fx/DeathFxManager";
import { HERO_BLOOD_COLOR } from "../../fx/particles";
import type { SkillAnimationController } from "../../skills/SkillAnimationController";

export interface DispatchFxParams {
	events: GameEvent[];
	gs: GameState;
	floor: FloorState | null;
	heroSprite: Phaser.GameObjects.Sprite;
	npcSprites: Map<string, Phaser.GameObjects.Sprite>;
	attackAnimator: AttackAnimator | null;
	damageNumbers: DamageNumberManager | null;
	deathFx: DeathFxManager | null;
	skillAnimController: SkillAnimationController | null;
	onAfterDispatch: () => void;
}

export function dispatchFxAndSync(params: DispatchFxParams): void {
	const {
		events,
		gs,
		floor,
		heroSprite,
		npcSprites,
		attackAnimator,
		damageNumbers,
		deathFx,
		skillAnimController,
		onAfterDispatch,
	} = params;

	if (events.length > 0 && floor) {
		const actorsById = floor.actorsById;
		const getActorIdx = (id: string) => actorsById[id]?.idx;
		const getBloodColor = (id: string): string => {
			const actor = actorsById[id];
			if (!actor || actor.def.type !== "npc") return HERO_BLOOD_COLOR;
			return (
				(npcsById as Record<string, { bloodColor: string }>)[actor.def.npcId]?.bloodColor ??
				HERO_BLOOD_COLOR
			);
		};

		const claimedEvents =
			skillAnimController?.dispatchNonHero(
				events,
				gs.heroId,
				(id) => npcSprites.get(id),
				getActorIdx,
				(evts) => damageNumbers?.handleEvents(evts, getActorIdx),
			) ?? new Set<GameEvent>();

		attackAnimator?.playEvents(
			events,
			gs.heroId,
			heroSprite,
			npcSprites,
			getActorIdx,
			getBloodColor,
		);

		// Exclude events already claimed by skill animation to avoid double-counting.
		const mainPassEvents =
			claimedEvents.size > 0 ? events.filter((e) => !claimedEvents.has(e)) : events;
		damageNumbers?.handleEvents(mainPassEvents, getActorIdx);
		deathFx?.handleEvents(events, gs.heroId, getActorIdx, getBloodColor);
	}

	onAfterDispatch();
}
