/**
 * Shared skill types. Mirror the structure from @app/content/schemas/skill
 * but without any Zod dependency, keeping packages/shared platform-agnostic.
 *
 * When adding a new active effect type:
 * 1. Add a new variant to ActiveSkillEffectDescriptor here.
 * 2. Add the matching Zod variant in packages/content/src/schemas/skill.ts.
 * 3. Add a handler in packages/shared/src/skills/effects/.
 * 4. Handle the new type in resolveSkill.ts.
 *
 * When adding a new passive effect type:
 * 1. Add a new variant to PassiveSkillEffectDescriptor here.
 * 2. Add the matching Zod variant in packages/content/src/schemas/skill.ts.
 * 3. Add a case in packages/shared/src/skills/applyPassiveEffect.ts.
 */

import type { DamageType } from "../combat/damageTypes";
import type { Actor, ActorId, AbilityName, FloorState, GameEvent, GameState } from "../game/types";
import type { Rng } from "../rng";

// ---------------------------------------------------------------------------
// Active skill effect descriptors (plain TypeScript — no Zod)
// ---------------------------------------------------------------------------

export interface AreaDamageEffect {
	type: "area_damage";
	dice: string;
	radiusTiles: number;
	scalingStat?: AbilityName;
	damageType: DamageType;
	/**
	 * Optional saving throw applied to each target:
	 * - Success scales the damage packets by successDamageMultiplier (default 0.5).
	 */
	savingThrow?: {
		saveAbility: AbilityName;
		dcStat: AbilityName;
		successDamageMultiplier?: number;
	};
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

export type ActiveSkillEffectDescriptor = AreaDamageEffect | ApplyStatusEffect | ChargeAttackEffect;

// ---------------------------------------------------------------------------
// Passive skill effect descriptors (plain TypeScript — no Zod)
// ---------------------------------------------------------------------------

export interface ModifyAttributeEffect {
	type: "modify_attribute";
	attribute: AbilityName;
	amount: number;
}

export interface ModifyArmorClassEffect {
	type: "modify_armor_class";
	amount: number;
}

export interface AddDamageResistanceEffect {
	type: "add_damage_resistance";
	damageType: DamageType;
}

export interface AddDamageImmunityEffect {
	type: "add_damage_immunity";
	damageType: DamageType;
}

export interface AddDamageDiceEffect {
	type: "add_damage_dice";
	dice: string;
	damageType: DamageType;
	/** Which attack types this bonus applies to. */
	appliesTo: "melee" | "area" | "any";
	/** If true, only adds dice on a critical hit (melee only). */
	onCritOnly: boolean;
}

export interface AddStatusImmunityEffect {
	type: "add_status_immunity";
	statusId: string;
}

export type PassiveSkillEffectDescriptor =
	| ModifyAttributeEffect
	| ModifyArmorClassEffect
	| AddDamageResistanceEffect
	| AddDamageImmunityEffect
	| AddDamageDiceEffect
	| AddStatusImmunityEffect;

// ---------------------------------------------------------------------------
// Skill definitions (plain TypeScript)
// ---------------------------------------------------------------------------

export interface ActiveSkillDefinition {
	skillType: "active";
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
	effects: ActiveSkillEffectDescriptor[];
}

export interface PassiveSkillDefinition {
	skillType: "passive";
	id: string;
	name: string;
	description: string;
	effects: PassiveSkillEffectDescriptor[];
}

export type SkillDefinition = ActiveSkillDefinition | PassiveSkillDefinition;

// ---------------------------------------------------------------------------
// Resolution input/output — everything the engine passes to the skill resolver
// ---------------------------------------------------------------------------

export interface SkillResolutionInput {
	skillDef: ActiveSkillDefinition;
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
