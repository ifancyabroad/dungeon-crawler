/**
 * Skill type re-exports and resolution interfaces.
 *
 * All skill effect and definition types are derived from the Zod schemas in
 * ./schemas.ts — that is the single source of truth. Runtime helpers
 * (hasActiveEffect, tickActiveEffects) live in ./activeEffects.ts.
 */

import type { Actor, ActorId, FloorState, GameEvent } from "../game/types";
import type { Rng } from "../rng";
import type { ActiveSkillDefinition } from "./schemas";

export type {
	ActiveSkillDefinition,
	ActiveSkillEffectDescriptor,
	ApplyShieldEffect,
	ApplyStatusEffect,
	AreaDamageEffect,
	AttackRollConfig,
	ChargeAttackEffect,
	ConeDamageEffect,
	DrainLifeEffect,
	HealSelfEffect,
	HealTargetEffect,
	LeapAttackEffect,
	LineDamageEffect,
	MultiStrikeEffect,
	PassiveSkillDefinition,
	PassiveSkillEffectDescriptor,
	PushActorEffect,
	SavingThrowConfig,
	ShadowStepEffect,
	SingleTargetDamageEffect,
	SkillDefinition,
	SneakAttackEffect,
	// Passive effect types
	AddAttackRollBonusEffect,
	AddDamageDiceEffect,
	AddDamageImmunityEffect,
	AddDamageResistanceEffect,
	AddSavingThrowProficiencyEffect,
	AddStatusImmunityEffect,
	ModifyArmorClassEffect,
	ModifyAttributeEffect,
	ModifyCritThresholdEffect,
	ModifyHitDieEffect,
	ModifyMaxHpEffect,
	TeleportSwapEffect,
} from "./schemas";

// ---------------------------------------------------------------------------
// Resolution input/output — everything the engine passes to the skill resolver
// ---------------------------------------------------------------------------

export interface SkillResolutionInput {
	skillDef: ActiveSkillDefinition;
	/** The actor using the skill (hero or NPC). */
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
	/**
	 * Precomputed opacity mask for the current floor (1 = opaque/wall).
	 * Required by line_damage to stop the beam at walls.
	 */
	opacityMask?: Uint8Array;
}

export interface SkillResolutionOutput {
	/** Updated floor state after all effects resolved. */
	floorState: FloorState;
	/** Updated caster (activeEffects, numericBuffs etc. may have changed). */
	caster: Actor;
	events: GameEvent[];
}
