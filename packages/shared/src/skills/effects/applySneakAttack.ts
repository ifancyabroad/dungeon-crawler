/**
 * Sneak attack effect: a high-damage DEX-based melee attack that can only be used
 * while the caster has the "stealth" status active. Using this skill breaks stealth.
 *
 * Uses DEX modifier for both the attack roll and damage scaling.
 */

import type { Actor, FloorState, GameEvent } from "../../game/types";
import type { Rng } from "../../rng";
import type { SneakAttackEffect } from "../types";
import { abilityModifier, rollD20, rollDiceExpr } from "../../combat/dice";
import { getActorProficiencyBonus } from "../../combat/savingThrows";
import { resolveDamagePackets } from "../../combat/resolveDamage";
import { applyDamageToActor } from "../../combat/applyDamageToActor";
import { hasActiveEffect } from "../activeEffects";
import { idxToXY } from "../../game/engine";

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
	if (!hasActiveEffect(caster, "stealth")) {
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
			activeEffects: caster.activeEffects.filter((e) => e.id !== "stealth"),
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

	// Damage roll (DEX scaled, crit doubles dice).
	const critMultiplier = isCritical ? 2 : 1;
	const rawDamage = rollDiceExpr(rng, effect.dice, critMultiplier);
	const rawAmount = Math.max(0, rawDamage + dexMod);

	const rawPackets: Parameters<typeof resolveDamagePackets>[0] = [
		{ damageType: effect.damageType, rawAmount, effectiveAmount: 0 },
	];

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
		activeEffects: caster.activeEffects.filter((e) => e.id !== "stealth"),
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
