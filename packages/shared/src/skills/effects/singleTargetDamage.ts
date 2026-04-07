/**
 * Single target damage effect: deals damage to one selected actor.
 *
 * When weaponDice: true, uses the caster's equipped weapon dice for the base roll.
 * bonusDice (if set) adds rank-scaling damage on top.
 *
 * Resolution order:
 *  1. If attackRoll is configured, roll D20 + modifier (+ proficiency) vs target AC.
 *     On a miss emit skill_miss and return — no damage, no saving throw.
 *  2. Roll damage dice (doubled on a crit when attackRoll was used).
 *  3. If savingThrow is configured (and no attackRoll miss), apply it.
 *  4. Apply passive bonuses matching the effect's attackCategory, then resolve resistances.
 *  5. Emit skill_hit (with real AttackResult) when an attack roll was made,
 *     or area_hit (no roll) when the effect always hits.
 */

import type { Actor, FloorState, GameEvent } from "../../game/types";
import type { Rng } from "../../rng";
import type { SingleTargetDamageEffect } from "../types";
import { abilityModifier, rollD20Adjusted, rollDiceExpr } from "../../combat/dice";
import {
	computeSavingThrowDC,
	resolveSavingThrow,
	getActorProficiencyBonus,
} from "../../combat/savingThrows";
import { resolveDamagePackets } from "../../combat/resolveDamage";
import { collectPassiveBonusPackets } from "../../combat/collectPassiveBonusPackets";
import { collectActiveEffectDamagePackets } from "../../combat/collectActiveEffectDamagePackets";
import { applyDamageToActor } from "../../combat/applyDamageToActor";
import { SKILLS_CONFIG } from "../../config";

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

	const isWeaponDice = effect.weaponDice === true;
	const dice = isWeaponDice ? caster.equippedWeaponDice.dice : effect.dice!;
	const damageType = isWeaponDice ? caster.equippedWeaponDice.damageType : effect.damageType!;

	const events: GameEvent[] = [];

	// --- Attack roll (optional) ---
	let isCritical = false;
	let naturalRoll = 0;
	let totalAttackRoll = 0;

	if (effect.attackRoll !== undefined) {
		const modStat = effect.attackRoll.modifierStat;
		const mod = abilityModifier(caster.attributes[modStat]);
		const pb = effect.attackRoll.useProficiency ? getActorProficiencyBonus(caster) : 0;
		const flatBonus = caster.attackBonusFlat ?? 0;

		// Advantage / disadvantage from active effects on the caster.
		let netAdvantage = false;
		let netDisadvantage = false;
		// Dice bonuses/penalties from active effects on the caster (e.g. bless, bane).
		let diceBonusTotal = 0;
		for (const eff of caster.activeEffects) {
			if (eff.remainingTurns <= 0) continue;
			if (eff.adjustments?.hasAdvantage) netAdvantage = true;
			if (eff.adjustments?.hasDisadvantage) netDisadvantage = true;
			if (eff.adjustments?.attackRollDiceBonus) {
				diceBonusTotal += rollDiceExpr(rng, eff.adjustments.attackRollDiceBonus);
			}
			if (eff.adjustments?.attackRollDicePenalty) {
				diceBonusTotal -= rollDiceExpr(rng, eff.adjustments.attackRollDicePenalty);
			}
		}

		// AC adjustments from defender's active effects.
		let acAdjustment = 0;
		for (const eff of target.activeEffects) {
			if (eff.remainingTurns <= 0) continue;
			acAdjustment += eff.adjustments?.acBonus ?? 0;
		}
		const effectiveAc = target.armorClass + acAdjustment;

		naturalRoll = rollD20Adjusted(rng, netAdvantage, netDisadvantage);
		totalAttackRoll = naturalRoll + mod + pb + flatBonus + diceBonusTotal;
		let critThreshold = caster.critThreshold ?? 20;
		for (const eff of caster.activeEffects) {
			if (eff.remainingTurns <= 0) continue;
			critThreshold -= eff.adjustments?.critThresholdReduction ?? 0;
		}
		critThreshold = Math.max(1, critThreshold);
		isCritical = naturalRoll >= critThreshold;
		const hit = isCritical || totalAttackRoll >= effectiveAc;

		if (!hit) {
			events.push({
				type: "skill_miss",
				attackerId: caster.id,
				defenderId: targetActorId,
				skillId,
				naturalRoll,
				totalRoll: totalAttackRoll,
				targetAc: effectiveAc,
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
	const rawDamage = rollDiceExpr(rng, dice, critMultiplier);
	const rawAmount = Math.max(0, rawDamage + statMod);

	const rawPackets: Parameters<typeof resolveDamagePackets>[0] = [
		{ damageType, rawAmount, effectiveAmount: 0 },
	];

	// Bonus dice for higher ranks (e.g. reckless_attack rank 2+).
	if (effect.bonusDice) {
		rawPackets.push({
			damageType: effect.bonusDamageType ?? damageType,
			rawAmount: rollDiceExpr(rng, effect.bonusDice, critMultiplier),
			effectiveAmount: 0,
		});
	}

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

	// Data-driven damage adjustments from active effects.
	// Weapon attacks use "melee"; spell single-target attacks use "ranged" (arcane_surge etc.).
	const activeEffectMode = effect.attackCategory === "weapon_attack" ? "melee" : "ranged";
	rawPackets.push(...collectActiveEffectDamagePackets(caster, rng, activeEffectMode, damageType));

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
			const multiplier =
				effect.savingThrow.successDamageMultiplier ??
				SKILLS_CONFIG.defaults.saveSuccessDamageMultiplier;
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

	const { updatedActor: rawTarget, events: damageEvents } = applyDamageToActor(
		target,
		effectiveDamage,
	);
	let updatedTarget = rawTarget;
	events.push(...damageEvents);

	// Apply on-hit status if the attack connected (miss returns early above, so we always hit here).
	if (effect.onHitStatus) {
		const filtered = updatedTarget.activeEffects.filter(
			(e) => e.id !== effect.onHitStatus!.statusId,
		);
		updatedTarget = {
			...updatedTarget,
			activeEffects: [
				...filtered,
				{
					id: effect.onHitStatus.statusId,
					remainingTurns: effect.onHitStatus.durationTurns,
					value: effect.onHitStatus.value,
				},
			],
		};
		events.push({
			type: "status_applied",
			actorId: targetActorId,
			statusId: effect.onHitStatus.statusId,
			durationTurns: effect.onHitStatus.durationTurns,
		});
	}

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
