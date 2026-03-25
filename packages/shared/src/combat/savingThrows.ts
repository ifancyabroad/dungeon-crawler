import type { Rng } from "../rng";
import type { Actor, AbilityName } from "../game/types";
import { abilityModifier, rollD20, rollDiceExpr } from "./dice";
import { COMBAT_CONFIG } from "../config";

/**
 * Proficiency bonus by actor level.
 * Levels 1-4: +2
 * Levels 5-8: +3
 * Levels 9-12: +4
 * Levels 13-16: +5
 * Levels 17-20: +6
 */
export function proficiencyBonusFromLevel(level: number): number {
	for (const threshold of COMBAT_CONFIG.proficiency.levelThresholds) {
		if (level >= threshold.min) return threshold.bonus;
	}
	return 2;
}

/**
 * Proficiency bonus by NPC challenge rating (CR ranges).
 * 0-4: +2
 * 5-8: +3
 * 9-12: +4
 * 13-16: +5
 * 17-20: +6
 * 21-24: +7
 * 25-28: +8
 * 29-30: +9
 */
export function proficiencyBonusFromChallengeRating(cr: number): number {
	for (const threshold of COMBAT_CONFIG.proficiency.challengeRatingThresholds) {
		if (cr >= threshold.min) return threshold.bonus;
	}
	return 2;
}

export function isActorProficientInSavingThrow(actor: Actor, ability: AbilityName): boolean {
	return actor.savingThrowProficiencies.includes(ability);
}

export function getActorProficiencyBonus(actor: Actor): number {
	// NPCs use CR; heroes use level.
	if (actor.challengeRating !== undefined) {
		return proficiencyBonusFromChallengeRating(actor.challengeRating);
	}
	return proficiencyBonusFromLevel(actor.level);
}

/** Spell/skill DC using the actor forcing the save. */
export function computeSavingThrowDC(caster: Actor, dcStat: AbilityName): number {
	const pb = getActorProficiencyBonus(caster);
	const mod = abilityModifier(caster.attributes[dcStat]);
	let flatBonus = 0;
	for (const eff of caster.activeEffects) {
		if (eff.remainingTurns <= 0) continue;
		flatBonus += eff.adjustments?.saveDcBonusFlat ?? 0;
	}
	return COMBAT_CONFIG.rules.saveDcBase + pb + mod + flatBonus;
}

/**
 * Resolve a single saving throw roll.
 * - Natural 20: auto-success
 * - Natural 1: auto-fail
 */
export function resolveSavingThrow(params: {
	rng: Rng;
	defender: Actor;
	saveAbility: AbilityName;
	dc: number;
}): {
	naturalRoll: number;
	abilityModifier: number;
	proficiencyBonusApplied: number;
	totalRoll: number;
	success: boolean;
	auto: "auto_success" | "auto_fail" | "none";
} {
	const { rng, defender, saveAbility, dc } = params;
	const naturalRoll = rollD20(rng);
	const abilityMod = abilityModifier(defender.attributes[saveAbility]);
	const proficient = isActorProficientInSavingThrow(defender, saveAbility);
	const proficiencyBonusApplied = proficient ? getActorProficiencyBonus(defender) : 0;

	// Dice bonuses/penalties from active status effects on the saving actor (e.g. bless, bane).
	let saveDiceBonusTotal = 0;
	for (const effect of defender.activeEffects) {
		if (effect.remainingTurns <= 0) continue;
		if (effect.adjustments?.savingThrowDiceBonus) {
			saveDiceBonusTotal += rollDiceExpr(rng, effect.adjustments.savingThrowDiceBonus);
		}
		if (effect.adjustments?.savingThrowDicePenalty) {
			saveDiceBonusTotal -= rollDiceExpr(rng, effect.adjustments.savingThrowDicePenalty);
		}
	}

	const totalRoll = naturalRoll + abilityMod + proficiencyBonusApplied + saveDiceBonusTotal;

	if (naturalRoll === COMBAT_CONFIG.rules.naturalRollAutoSuccess) {
		return {
			naturalRoll,
			abilityModifier: abilityMod,
			proficiencyBonusApplied,
			totalRoll,
			success: true,
			auto: "auto_success",
		};
	}
	if (naturalRoll === COMBAT_CONFIG.rules.naturalRollAutoFail) {
		return {
			naturalRoll,
			abilityModifier: abilityMod,
			proficiencyBonusApplied,
			totalRoll,
			success: false,
			auto: "auto_fail",
		};
	}

	const success = totalRoll >= dc;
	return {
		naturalRoll,
		abilityModifier: abilityMod,
		proficiencyBonusApplied,
		totalRoll,
		success,
		auto: "none",
	};
}
