/**
 * Multi-strike effect: makes strikeCount separate attack rolls against a single target.
 *
 * When weaponDice: true, uses the caster's equipped weapon dice for each strike.
 * bonusDice (if set) adds rank-scaling damage on top of each hit.
 *
 * Each strike is an independent d20 roll + STR modifier vs the target's AC. Crits
 * double the damage dice for that strike. Passive bonuses matching the effect's
 * attackCategory apply to every strike. Active melee damage adjustments are included
 * per strike.
 *
 * Emits one skill_hit event per strike (so the combat log and client animations
 * can react individually). Processing stops early if the target dies mid-combo.
 */

import type { Actor, FloorState, GameEvent } from "../../game/types";
import type { Rng } from "../../rng";
import type { MultiStrikeEffect } from "../types";
import { abilityModifier, rollD20Adjusted, rollDiceExpr } from "../../combat/dice";
import { resolveDamagePackets } from "../../combat/resolveDamage";
import { collectPassiveBonusPackets } from "../../combat/collectPassiveBonusPackets";
import { collectActiveEffectDamagePackets } from "../../combat/collectActiveEffectDamagePackets";
import { applyDamageToActor } from "../../combat/applyDamageToActor";

export function applyMultiStrike(
	effect: MultiStrikeEffect,
	caster: Actor,
	targetActorId: string,
	floorState: FloorState,
	rng: Rng,
	skillId: string,
): { floorState: FloorState; events: GameEvent[] } | { error: string } {
	const initialTarget = floorState.actorsById[targetActorId];
	if (!initialTarget || !initialTarget.alive) return { error: "multi_strike_no_target" };

	const isWeaponDice = effect.weaponDice === true;
	const dice = isWeaponDice ? caster.equippedWeaponDice.dice : effect.dice!;
	const damageType = isWeaponDice ? caster.equippedWeaponDice.damageType : effect.damageType!;

	const events: GameEvent[] = [];
	let actorsById = { ...floorState.actorsById };

	const strMod =
		effect.scalingStat !== undefined
			? abilityModifier(caster.attributes[effect.scalingStat])
			: abilityModifier(caster.attributes.strength);

	const flatBonus = caster.attackBonusFlat ?? 0;
	const critThreshold = caster.critThreshold ?? 20;

	// Pre-compute advantage/disadvantage and dice bonuses once (applied identically to each strike).
	let netAdvantage = false;
	let netDisadvantage = false;
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

	for (let i = 0; i < effect.strikeCount; i++) {
		const currentTarget = actorsById[targetActorId];
		if (!currentTarget || !currentTarget.alive) break;

		// AC with active-effect adjustments.
		let acAdjustment = 0;
		for (const eff of currentTarget.activeEffects) {
			if (eff.remainingTurns <= 0) continue;
			acAdjustment += eff.adjustments?.acBonus ?? 0;
		}
		const effectiveAc = currentTarget.armorClass + acAdjustment;

		const naturalRoll = rollD20Adjusted(rng, netAdvantage, netDisadvantage);
		const totalAttackRoll = naturalRoll + strMod + flatBonus + diceBonusTotal;
		const isCritical = naturalRoll >= critThreshold;
		const hit = isCritical || totalAttackRoll >= effectiveAc;

		let damage = 0;
		let damagePackets: ReturnType<typeof resolveDamagePackets>["packets"] = [];

		if (hit) {
			const critMultiplier = isCritical ? 2 : 1;
			const rawDamage = rollDiceExpr(rng, dice, critMultiplier);
			const rawAmount = Math.max(0, rawDamage + strMod);

			const rawPackets: Parameters<typeof resolveDamagePackets>[0] = [
				{ damageType, rawAmount, effectiveAmount: 0 },
			];

			// Bonus dice for higher ranks.
			if (effect.bonusDice) {
				rawPackets.push({
					damageType: effect.bonusDamageType ?? damageType,
					rawAmount: rollDiceExpr(rng, effect.bonusDice, critMultiplier),
					effectiveAmount: 0,
				});
			}

			// Passive bonuses whose appliesTo matches the effect's attack category.
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

			// Data-driven melee damage adjustments.
			rawPackets.push(...collectActiveEffectDamagePackets(caster, rng, "melee", damageType));

			const resolved = resolveDamagePackets(rawPackets, currentTarget);
			damage = resolved.totalEffectiveDamage;
			damagePackets = resolved.packets;
		}

		events.push({
			type: "skill_hit",
			attackerId: caster.id,
			defenderId: targetActorId,
			skillId,
			result: {
				hit,
				critical: isCritical,
				naturalRoll,
				totalAttackRoll,
				damage,
				damagePackets,
				targetAc: effectiveAc,
			},
		});

		if (hit) {
			// Start with the unmodified target; apply damage if any landed.
			let updatedActor = currentTarget;
			if (damage > 0) {
				const { updatedActor: damagedActor, events: damageEvents } = applyDamageToActor(
					currentTarget,
					damage,
				);
				updatedActor = damagedActor;
				events.push(...damageEvents);
			}

			// On-hit status fires on any successful hit, regardless of whether damage was dealt.
			if (effect.onHitStatus) {
				const filtered = updatedActor.activeEffects.filter(
					(e) => e.id !== effect.onHitStatus!.statusId,
				);
				updatedActor = {
					...updatedActor,
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

			actorsById = { ...actorsById, [targetActorId]: updatedActor };
			if (!updatedActor.alive) {
				events.push({ type: "death", actorId: targetActorId });
				break;
			}
		}
	}

	return { floorState: { ...floorState, actorsById }, events };
}
