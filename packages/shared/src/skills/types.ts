/**
 * Shared skill types. Mirror the structure from @app/content/schemas/skill
 * but without any Zod dependency, keeping packages/shared platform-agnostic.
 *
 * When adding a new effect type:
 * 1. Add a new variant to SkillEffectDescriptor here.
 * 2. Add the matching Zod variant in packages/content/src/schemas/skill.ts.
 * 3. Add a handler in packages/shared/src/skills/effects/.
 * 4. Handle the new type in resolveSkill.ts.
 */

// ---------------------------------------------------------------------------
// Effect descriptors (plain TypeScript — no Zod)
// ---------------------------------------------------------------------------

import type { DamageType } from "../combat/damageTypes";

export interface AreaDamageEffect {
	type: "area_damage";
	dice: string;
	radiusTiles: number;
	scalingStat?: "intelligence" | "strength";
	damageType: DamageType;
}

export interface ApplyStatusEffect {
	type: "apply_status";
	statusId: string;
	durationTurns: number;
}

export interface ChargeAttackEffect {
	type: "charge_attack";
	maxRangeTiles: number;
	/**
	 * Extra damage dice on a hit, in NdM notation (e.g. "1d8").
	 * Doubled on a critical hit; no ability modifier added.
	 */
	bonusDice: string;
	bonusDamageType: DamageType;
}

export type SkillEffectDescriptor = AreaDamageEffect | ApplyStatusEffect | ChargeAttackEffect;

// ---------------------------------------------------------------------------
// Skill definition (plain TypeScript)
// ---------------------------------------------------------------------------

export interface SkillDefinition {
	id: string;
	name: string;
	description: string;
	cooldown: number;
	targetType: "none" | "tile" | "actor";
	range?: number;
	/**
	 * When true, using this skill does NOT remove the "stealth" status effect from the caster.
	 * Default false — most active skills reveal the hero.
	 */
	maintainsStealth?: boolean;
	effects: SkillEffectDescriptor[];
}

// ---------------------------------------------------------------------------
// Resolution input — everything the engine passes to the skill resolver
// ---------------------------------------------------------------------------

import type { Actor, ActorId, FloorState, GameEvent, GameState } from "../game/types";
import type { Rng } from "../rng";

export interface SkillResolutionInput {
	skillDef: SkillDefinition;
	/** The actor using the skill (hero or, in future, a monster). */
	caster: Actor;
	casterId: ActorId;
	floorState: FloorState;
	width: number;
	height: number;
	rng: Rng;
	/** Flat tile index of the targeted tile (for "tile" targetType skills). */
	targetTileIdx?: number;
	/** Id of the targeted actor (for "actor" targetType skills). */
	targetActorId?: string;
}

export interface SkillResolutionOutput {
	/** Updated floor state after all effects resolved. */
	floorState: FloorState;
	/** Updated caster (statusEffects modified etc.). */
	caster: Actor;
	events: GameEvent[];
}

// ---------------------------------------------------------------------------
// Helper: query active status effects on an actor
// ---------------------------------------------------------------------------

/** Returns true if the actor currently has an active effect with the given id. */
export function hasStatusEffect(actor: Actor, id: string): boolean {
	return actor.statusEffects.some((e) => e.id === id && e.remainingTurns > 0);
}

/**
 * Tick down all status effects on the hero; remove those that have expired.
 *
 * BUG FIX: the previous early-return used a length comparison that prevented
 * remainingTurns from ever being decremented when effects were still active.
 * The correct guard is simply "no effects at all → skip".
 *
 * When stealth expires naturally, all living monsters are alerted to the hero's
 * last position so they resume chasing.
 */
export function tickStatusEffects(state: GameState): GameState {
	const fi = state.heroFloorIndex;
	const floor = state.floors[fi];
	if (!floor) return state;

	const heroId = state.heroId;
	const hero = floor.state.actorsById[heroId];
	if (!hero || hero.statusEffects.length === 0) return state;

	const hadStealth = hasStatusEffect(hero, "stealth");

	const newStatusEffects = hero.statusEffects
		.map((e) => ({ ...e, remainingTurns: e.remainingTurns - 1 }))
		.filter((e) => e.remainingTurns > 0);

	const stealthExpired = hadStealth && !newStatusEffects.some((e) => e.id === "stealth");

	const updatedHero: Actor = { ...hero, statusEffects: newStatusEffects };
	let actorsById: Record<string, Actor> = { ...floor.state.actorsById, [heroId]: updatedHero };

	// When stealth expires naturally, alert all monsters to the hero's position
	// so they resume investigating rather than wandering indefinitely.
	if (stealthExpired) {
		for (const [id, actor] of Object.entries(actorsById)) {
			if (id === heroId || !actor.alive || actor.def.type !== "monster" || !actor.aiState)
				continue;
			actorsById = {
				...actorsById,
				[id]: { ...actor, aiState: { ...actor.aiState!, lastKnownHeroIdx: hero.idx } },
			};
		}
	}

	const newFloors = state.floors.slice();
	newFloors[fi] = {
		...floor,
		state: { ...floor.state, actorsById },
	};
	return { ...state, floors: newFloors };
}
