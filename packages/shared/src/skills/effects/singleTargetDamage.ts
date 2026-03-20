/**
 * Single target damage effect: deals damage to one selected actor.
 *
 * Resolution order:
 *  1. If attackRoll is configured, roll D20 + modifier (+ proficiency) vs target AC.
 *     On a miss emit skill_miss and return — no damage, no saving throw.
 *  2. Roll damage dice (doubled on a crit when attackRoll was used).
 *  3. If savingThrow is configured (and no attackRoll miss), apply it.
 *  4. Apply passive "any" bonuses from the caster, then resolve resistances.
 *  5. Emit skill_hit (with real AttackResult) when an attack roll was made,
 *     or area_hit (no roll) when the effect always hits.
 */

import type { Actor, FloorState, GameEvent } from "../../game/types";
import type { Rng } from "../../rng";
import type { SingleTargetDamageEffect } from "../types";
import { abilityModifier, rollD20, rollDiceExpr } from "../../combat/dice";
import {
	computeSavingThrowDC,
	resolveSavingThrow,
	getActorProficiencyBonus,
} from "../../combat/savingThrows";
import { resolveDamagePackets } from "../../combat/resolveDamage";

export function applySingleTargetDamage(
	effect: SingleTargetDamageEffect,
	caster: Actor,
	targetActorId: string,
	floorState: FloorState,
	rng: Rng,
	skillId: string,
): { floorState: FloorState; events: GameEvent[] } | { error: string } {
	const target = floorState.actorsById[targetActorId];
	if (!target || !target.alive) return { error: "single_target_no_target" };

	const events: GameEvent[] = [];

	// --- Attack roll (optional) ---
	let isCritical = false;
	let naturalRoll = 0;
	let totalAttackRoll = 0;

	if (effect.attackRoll !== undefined) {
		const modStat = effect.attackRoll.modifierStat;
		const mod = abilityModifier(caster.attributes[modStat]);
		const pb = effect.attackRoll.useProficiency ? getActorProficiencyBonus(caster) : 0;

		naturalRoll = rollD20(rng);
		totalAttackRoll = naturalRoll + mod + pb;
		isCritical = naturalRoll === 20;
		const hit = isCritical || totalAttackRoll >= target.armorClass;

		if (!hit) {
			events.push({
				type: "skill_miss",
				attackerId: caster.id,
				defenderId: targetActorId,
				skillId,
				naturalRoll,
				totalRoll: totalAttackRoll,
				targetAc: target.armorClass,
			});
			return { floorState, events };
		}
	}

	// --- Damage roll ---
	const statMod =
		effect.scalingStat !== undefined
			? abilityModifier(caster.attributes[effect.scalingStat])
			: 0;

	const critMultiplier = isCritical ? 2 : 1;
	const rawDamage = rollDiceExpr(rng, effect.dice, critMultiplier);
	const rawAmount = Math.max(0, rawDamage + statMod);

	const rawPackets: Parameters<typeof resolveDamagePackets>[0] = [
		{ damageType: effect.damageType, rawAmount, effectiveAmount: 0 },
	];

	// Apply passive "any" bonuses. Melee-only and area-only bonuses are excluded
	// since this is a targeted skill attack, not a weapon swing or AoE.
	for (const bonus of caster.passiveDamageBonuses) {
		if (bonus.appliesTo !== "any") continue;
		if (bonus.onCritOnly && !isCritical) continue;
		rawPackets.push({
			damageType: bonus.damageType,
			rawAmount: rollDiceExpr(rng, bonus.dice, isCritical && bonus.onCritOnly ? 2 : 1),
			effectiveAmount: 0,
		});
	}

	// --- Saving throw (optional, only when no attackRoll miss already occurred) ---
	let packetsToResolve = rawPackets;
	if (effect.savingThrow !== undefined) {
		const dc = computeSavingThrowDC(caster, effect.savingThrow.dcStat);
		const save = resolveSavingThrow({
			rng,
			defender: target,
			saveAbility: effect.savingThrow.saveAbility,
			dc,
		});

		if (save.success) {
			const multiplier = effect.savingThrow.successDamageMultiplier ?? 0.5;
			packetsToResolve = rawPackets.map((p) => ({
				...p,
				rawAmount: Math.floor(p.rawAmount * multiplier),
			}));
		}

		events.push({
			type: "saving_throw",
			casterId: caster.id,
			defenderId: targetActorId,
			saveAbility: effect.savingThrow.saveAbility,
			naturalRoll: save.naturalRoll,
			abilityModifier: save.abilityModifier,
			proficiencyBonusApplied: save.proficiencyBonusApplied,
			dc,
			totalRoll: save.totalRoll,
			success: save.success,
			auto: save.auto,
		});
	}

	const resolved = resolveDamagePackets(packetsToResolve, target);
	const effectiveDamage = resolved.totalEffectiveDamage;

	if (effect.attackRoll !== undefined) {
		// A real attack roll was made — emit skill_hit with the full result.
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
	} else {
		// No attack roll — the effect always hits; use area_hit so no spurious roll values are emitted.
		events.push({
			type: "area_hit",
			attackerId: caster.id,
			defenderId: targetActorId,
			damage: effectiveDamage,
			damagePackets: resolved.packets,
			skillId,
		});
	}

	const newHp = Math.max(0, target.hp - effectiveDamage);
	const updatedTarget: Actor = { ...target, hp: newHp, alive: newHp > 0 };

	if (!updatedTarget.alive) {
		events.push({ type: "death", actorId: targetActorId });
	}

	return {
		floorState: {
			...floorState,
			actorsById: { ...floorState.actorsById, [targetActorId]: updatedTarget },
		},
		events,
	};
}
