/**
 * Area damage effect: deals damage to every living actor within radiusTiles of a target tile.
 * Dice expression is parsed (e.g. "2d6"), optionally scaled by a stat modifier.
 * Passive damage bonuses from the caster that apply to "area" or "any" are also added.
 */

import type { Actor, FloorState, GameEvent } from "../../game/types";
import type { Rng } from "../../rng";
import type { AreaDamageEffect } from "../types";
import { abilityModifier, rollDiceExpr } from "../../combat/dice";
import { computeSavingThrowDC, resolveSavingThrow } from "../../combat/savingThrows";
import { resolveDamagePackets } from "../../combat/resolveDamage";
import { applyDamageToActor } from "../../combat/applyDamageToActor";
import { idxToXY } from "../../game/engine";

/** Chebyshev distance (diagonal counts as 1). */
function chebyshevDistance(ax: number, ay: number, bx: number, by: number): number {
	return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

export function applyAreaDamage(
	effect: AreaDamageEffect,
	caster: Actor,
	targetTileIdx: number,
	floorState: FloorState,
	width: number,
	rng: Rng,
	skillId: string,
): { floorState: FloorState; events: GameEvent[] } {
	const { x: tx, y: ty } = idxToXY(targetTileIdx, width);
	const events: GameEvent[] = [];

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

		const { x: ax, y: ay } = idxToXY(actor.idx, width);
		if (chebyshevDistance(ax, ay, tx, ty) > effect.radiusTiles) continue;

		const rawDamage = rollDiceExpr(rng, effect.dice);
		const rawAmount = Math.max(0, rawDamage + statMod);

		const rawPackets: Parameters<typeof resolveDamagePackets>[0] = [
			{
				damageType: effect.damageType,
				rawAmount,
				effectiveAmount: 0,
			},
		];

		// Apply passive area/any damage bonuses from the caster
		for (const bonus of caster.passiveDamageBonuses) {
			if (bonus.appliesTo !== "area" && bonus.appliesTo !== "any") continue;
			// onCritOnly bonuses don't apply to area damage (no crit concept)
			if (bonus.onCritOnly) continue;
			const bonusRoll = rollDiceExpr(rng, bonus.dice);
			rawPackets.push({
				damageType: bonus.damageType,
				rawAmount: bonusRoll,
				effectiveAmount: 0,
			});
		}

		// Data-driven areaDamageFlat adjustments from active effects (e.g. empower_spell).
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
				const multiplier = effect.savingThrow.successDamageMultiplier ?? 0.5;
				packetsToResolve = rawPackets.map((p) => ({
					...p,
					// Match the engine's resistance behaviour (floors half damage) to keep HP integers.
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
