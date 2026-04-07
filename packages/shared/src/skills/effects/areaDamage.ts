/**
 * Area damage effect: deals damage to every living actor within radiusTiles of a target tile.
 * When weaponDice: true, uses the caster's equipped weapon dice instead of a fixed expression.
 * Passive damage bonuses whose appliesTo matches the effect's attackCategory are also added.
 */

import type { Actor, FloorState, GameEvent } from "../../game/types";
import type { Rng } from "../../rng";
import type { AreaDamageEffect } from "../types";
import { abilityModifier, rollDiceExpr } from "../../combat/dice";
import { computeSavingThrowDC, resolveSavingThrow } from "../../combat/savingThrows";
import { resolveDamagePackets } from "../../combat/resolveDamage";
import { collectPassiveBonusPackets } from "../../combat/collectPassiveBonusPackets";
import { collectActiveEffectDamagePackets } from "../../combat/collectActiveEffectDamagePackets";
import { applyDamageToActor } from "../../combat/applyDamageToActor";
import { idxToXY } from "../../game/engineUtils";
import { SKILLS_CONFIG } from "../../config";

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

		const { x: ax, y: ay } = idxToXY(actor.idx, width);
		if (chebyshevDistance(ax, ay, tx, ty) > effect.radiusTiles) continue;

		const rawDamage = rollDiceExpr(rng, dice);
		const rawAmount = Math.max(0, rawDamage + statMod);

		const rawPackets: Parameters<typeof resolveDamagePackets>[0] = [
			{ damageType, rawAmount, effectiveAmount: 0 },
		];

		// Bonus dice for higher ranks (e.g. whirlwind rank 2+).
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

		// Data-driven areaDamageFlat adjustments from active effects (e.g. empower_spell).
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
