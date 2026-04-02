/**
 * Cone damage effect: deals damage to every living actor within a cone
 * emanating from the caster toward a target tile direction.
 * No wall stopping — the cone fills the entire arc.
 */

import type { Actor, FloorState, GameEvent } from "../../game/types";
import type { Rng } from "../../rng";
import type { ConeDamageEffect } from "../types";
import { abilityModifier, rollDiceExpr } from "../../combat/dice";
import { computeSavingThrowDC, resolveSavingThrow } from "../../combat/savingThrows";
import { resolveDamagePackets } from "../../combat/resolveDamage";
import { collectPassiveBonusPackets } from "../../combat/collectPassiveBonusPackets";
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

		const rawDamage = rollDiceExpr(rng, effect.dice);
		const rawAmount = Math.max(0, rawDamage + statMod);

		const rawPackets: Parameters<typeof resolveDamagePackets>[0] = [
			{ damageType: effect.damageType, rawAmount, effectiveAmount: 0 },
		];

		// Apply passive area/any damage bonuses from the caster.
		rawPackets.push(
			...collectPassiveBonusPackets(caster, rng, "area", false, false, effect.damageType),
		);

		// Data-driven area damage adjustments from active effects.
		for (const eff of caster.activeEffects) {
			if (eff.remainingTurns <= 0) continue;
			const adj = eff.adjustments?.areaDamageFlat;
			if (adj) {
				rawPackets.push({
					damageType: adj.damageType,
					rawAmount: adj.amount,
					effectiveAmount: 0,
				});
			}
			const diceBonusExpr = eff.adjustments?.areaDamageDiceBonus;
			if (diceBonusExpr) {
				rawPackets.push({
					damageType: effect.damageType,
					rawAmount: rollDiceExpr(rng, diceBonusExpr),
					effectiveAmount: 0,
				});
			}
		}

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
