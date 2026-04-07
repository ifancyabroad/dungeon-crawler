/**
 * Cone damage effect: deals damage to every living actor within a cone
 * emanating from the caster toward a target tile direction.
 * When weaponDice: true, uses the caster's equipped weapon dice instead of a fixed expression.
 * No wall stopping — the cone fills the entire arc.
 */

import type { Actor, FloorState, GameEvent } from "../../game/types";
import type { Rng } from "../../rng";
import type { ConeDamageEffect } from "../types";
import { abilityModifier, rollDiceExpr } from "../../combat/dice";
import { computeSavingThrowDC, resolveSavingThrow } from "../../combat/savingThrows";
import { resolveDamagePackets } from "../../combat/resolveDamage";
import { collectPassiveBonusPackets } from "../../combat/collectPassiveBonusPackets";
import { collectActiveEffectDamagePackets } from "../../combat/collectActiveEffectDamagePackets";
import { applyDamageToActor } from "../../combat/applyDamageToActor";
import { getTilesInCone } from "../geometry";
import { SKILLS_CONFIG } from "../../config";

export function applyConeDamage(
	effect: ConeDamageEffect,
	caster: Actor,
	targetTileIdx: number,
	floorState: FloorState,
	width: number,
	height: number,
	rng: Rng,
	skillId: string,
): { floorState: FloorState; events: GameEvent[] } {
	const coneTiles = getTilesInCone(
		caster.idx,
		targetTileIdx,
		width,
		height,
		effect.rangeTiles,
		effect.angleDegrees ?? SKILLS_CONFIG.defaults.coneAngleDegrees,
	);

	const events: GameEvent[] = [];

	if (coneTiles.length === 0) return { floorState, events };

	const coneTileSet = new Set(coneTiles);

	const isWeaponDice = effect.weaponDice === true;
	const dice = isWeaponDice ? caster.equippedWeaponDice.dice : effect.dice!;
	const damageType = isWeaponDice ? caster.equippedWeaponDice.damageType : effect.damageType!;

	const statMod =
		effect.scalingStat !== undefined
			? abilityModifier(caster.attributes[effect.scalingStat])
			: 0;

	const savingThrowDc =
		effect.savingThrow !== undefined
			? computeSavingThrowDC(caster, effect.savingThrow.dcStat)
			: 0;

	let actorsById = { ...floorState.actorsById };

	for (const [id, actor] of Object.entries(actorsById)) {
		if (!actor.alive || id === caster.id) continue;
		if (!coneTileSet.has(actor.idx)) continue;

		const rawDamage = rollDiceExpr(rng, dice);
		const rawAmount = Math.max(0, rawDamage + statMod);

		const rawPackets: Parameters<typeof resolveDamagePackets>[0] = [
			{ damageType, rawAmount, effectiveAmount: 0 },
		];

		// Bonus dice for higher ranks (e.g. cleave rank 2+).
		if (effect.bonusDice) {
			rawPackets.push({
				damageType: effect.bonusDamageType ?? damageType,
				rawAmount: rollDiceExpr(rng, effect.bonusDice),
				effectiveAmount: 0,
			});
		}

		// Apply passive bonuses whose appliesTo matches the effect's attack category.
		rawPackets.push(
			...collectPassiveBonusPackets(
				caster,
				rng,
				effect.attackCategory,
				false,
				false,
				damageType,
			),
		);

		// Data-driven area damage adjustments from active effects.
		rawPackets.push(...collectActiveEffectDamagePackets(caster, rng, "area", damageType));

		let packetsToResolve = rawPackets;
		if (effect.savingThrow !== undefined) {
			const save = resolveSavingThrow({
				rng,
				defender: actor,
				saveAbility: effect.savingThrow.saveAbility,
				dc: savingThrowDc,
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
				defenderId: id,
				saveAbility: effect.savingThrow.saveAbility,
				naturalRoll: save.naturalRoll,
				abilityModifier: save.abilityModifier,
				proficiencyBonusApplied: save.proficiencyBonusApplied,
				dc: savingThrowDc,
				totalRoll: save.totalRoll,
				success: save.success,
				auto: save.auto,
			});
		}

		const resolved = resolveDamagePackets(packetsToResolve, actor);
		const effectiveDamage = resolved.totalEffectiveDamage;

		const { updatedActor, events: damageEvents } = applyDamageToActor(actor, effectiveDamage);
		actorsById = { ...actorsById, [id]: updatedActor };
		events.push(...damageEvents);

		events.push({
			type: "area_hit",
			attackerId: caster.id,
			defenderId: id,
			damage: effectiveDamage,
			damagePackets: resolved.packets,
			skillId,
		});

		if (!updatedActor.alive) {
			events.push({ type: "death", actorId: id });
		}
	}

	return { floorState: { ...floorState, actorsById }, events };
}
