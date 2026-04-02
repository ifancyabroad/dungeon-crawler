/**
 * Line damage effect: deals damage to every living actor in a straight line
 * from the caster toward a target tile, stopping before the first wall.
 */

import type { Actor, FloorState, GameEvent } from "../../game/types";
import type { Rng } from "../../rng";
import type { LineDamageEffect } from "../types";
import { abilityModifier, rollDiceExpr } from "../../combat/dice";
import { computeSavingThrowDC, resolveSavingThrow } from "../../combat/savingThrows";
import { resolveDamagePackets } from "../../combat/resolveDamage";
import { collectPassiveBonusPackets } from "../../combat/collectPassiveBonusPackets";
import { collectActiveEffectDamagePackets } from "../../combat/collectActiveEffectDamagePackets";
import { applyDamageToActor } from "../../combat/applyDamageToActor";
import { getTilesInLine } from "../geometry";
import { SKILLS_CONFIG } from "../../config";

export function applyLineDamage(
	effect: LineDamageEffect,
	caster: Actor,
	targetTileIdx: number,
	floorState: FloorState,
	width: number,
	height: number,
	rng: Rng,
	skillId: string,
	opacityMask?: Uint8Array,
): { floorState: FloorState; events: GameEvent[] } {
	const lineTiles = getTilesInLine(caster.idx, targetTileIdx, width, height, opacityMask);

	const events: GameEvent[] = [];

	if (lineTiles.length === 0) return { floorState, events };

	const lineTileSet = new Set(lineTiles);

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
		if (!lineTileSet.has(actor.idx)) continue;

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
		rawPackets.push(
			...collectActiveEffectDamagePackets(caster, rng, "area", effect.damageType),
		);

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
