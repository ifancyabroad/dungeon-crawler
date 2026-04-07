/**
 * Sneak attack effect: a high-damage DEX-based melee attack that can only be used
 * while the caster has the "stealth" status active. Using this skill breaks stealth.
 *
 * When weaponDice: true, rolls the equipped weapon's dice as the base hit plus the
 * sneak attack bonus dice (effect.dice) on top — matching 5E mechanics.
 * Uses DEX modifier for both the attack roll and damage scaling.
 */

import type { Actor, FloorState, GameEvent } from "../../game/types";
import type { Rng } from "../../rng";
import type { SneakAttackEffect } from "../types";
import { abilityModifier, rollD20, rollDiceExpr } from "../../combat/dice";
import { getActorProficiencyBonus } from "../../combat/savingThrows";
import { resolveDamagePackets } from "../../combat/resolveDamage";
import { collectPassiveBonusPackets } from "../../combat/collectPassiveBonusPackets";
import { applyDamageToActor } from "../../combat/applyDamageToActor";
import { hasActiveEffect } from "../activeEffects";
import { STATUS_HOOKS } from "../../config/skills";
import { idxToXY } from "../../game/engineUtils";

function chebyshevDistance(ax: number, ay: number, bx: number, by: number): number {
	return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

export function applySneakAttack(
	effect: SneakAttackEffect,
	caster: Actor,
	targetActorId: string,
	floorState: FloorState,
	width: number,
	rng: Rng,
	skillId: string,
): { floorState: FloorState; caster: Actor; events: GameEvent[] } | { error: string } {
	// Stealth gate: sneak attack requires active stealth.
	if (!hasActiveEffect(caster, STATUS_HOOKS.STEALTH)) {
		return { error: "sneak_attack_requires_stealth" };
	}

	const target = floorState.actorsById[targetActorId];
	if (!target || !target.alive) return { error: "sneak_attack_no_target" };

	// Melee range check: target must be adjacent (Chebyshev 1).
	const { x: cx, y: cy } = idxToXY(caster.idx, width);
	const { x: tx, y: ty } = idxToXY(target.idx, width);
	if (chebyshevDistance(cx, cy, tx, ty) > 1) return { error: "sneak_attack_out_of_range" };

	const events: GameEvent[] = [];
	const dexMod = abilityModifier(caster.attributes.dexterity);
	const pb = getActorProficiencyBonus(caster);

	// DEX-based attack roll with proficiency.
	const naturalRoll = rollD20(rng);
	const totalAttackRoll = naturalRoll + dexMod + pb;
	const isCritical = naturalRoll === 20;
	const hit = isCritical || totalAttackRoll >= target.armorClass;

	if (!hit) {
		// Break stealth on attempt regardless.
		const casterAfterMiss: Actor = {
			...caster,
			activeEffects: caster.activeEffects.filter((e) => e.id !== STATUS_HOOKS.STEALTH),
		};
		events.push({
			type: "skill_miss",
			attackerId: caster.id,
			defenderId: targetActorId,
			skillId,
			naturalRoll,
			totalRoll: totalAttackRoll,
			targetAc: target.armorClass,
		});
		return { floorState, caster: casterAfterMiss, events };
	}

	const isWeaponDice = effect.weaponDice === true;
	const damageType = isWeaponDice ? caster.equippedWeaponDice.damageType : "piercing";
	const critMultiplier = isCritical ? 2 : 1;

	// Base weapon hit + sneak attack bonus dice.
	const weaponRaw = isWeaponDice
		? rollDiceExpr(rng, caster.equippedWeaponDice.dice, critMultiplier)
		: 0;
	const sneakRaw = rollDiceExpr(rng, effect.dice, critMultiplier);
	const rawAmount = Math.max(0, weaponRaw + sneakRaw + dexMod);

	const rawPackets: Parameters<typeof resolveDamagePackets>[0] = [
		{ damageType, rawAmount, effectiveAmount: 0 },
	];

	// Apply passive bonuses whose appliesTo matches the effect's attack category.
	rawPackets.push(
		...collectPassiveBonusPackets(
			caster,
			rng,
			effect.attackCategory,
			isCritical,
			true,
			damageType,
		),
	);

	const resolved = resolveDamagePackets(rawPackets, target);
	const effectiveDamage = resolved.totalEffectiveDamage;

	events.push({
		type: "skill_hit",
		attackerId: caster.id,
		defenderId: targetActorId,
		skillId,
		result: {
			hit: true,
			critical: isCritical,
			naturalRoll,
			totalAttackRoll,
			damage: effectiveDamage,
			damagePackets: resolved.packets,
			targetAc: target.armorClass,
		},
	});

	const { updatedActor: updatedTarget, events: damageEvents } = applyDamageToActor(
		target,
		effectiveDamage,
	);
	events.push(...damageEvents);

	if (!updatedTarget.alive) {
		events.push({ type: "death", actorId: targetActorId });
	}

	// Always break stealth on a successful sneak attack.
	const casterAfterAttack: Actor = {
		...caster,
		activeEffects: caster.activeEffects.filter((e) => e.id !== STATUS_HOOKS.STEALTH),
	};

	return {
		floorState: {
			...floorState,
			actorsById: { ...floorState.actorsById, [targetActorId]: updatedTarget },
		},
		caster: casterAfterAttack,
		events,
	};
}
