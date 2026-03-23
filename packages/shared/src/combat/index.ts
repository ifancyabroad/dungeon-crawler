export { rollDice, rollD20, abilityModifier, computeUnarmoredAC } from "./dice";
export { resolveAttack } from "./resolveAttack";
export { applyDamageToActor, type DamageApplicationResult } from "./applyDamageToActor";
export { UNARMED_WEAPON, type AttackResult, type WeaponDice } from "./types";
export { DAMAGE_TYPES, type DamageType } from "./damageTypes";
export {
	computeSavingThrowDC,
	resolveSavingThrow,
	isActorProficientInSavingThrow,
	getActorProficiencyBonus,
	proficiencyBonusFromLevel,
	proficiencyBonusFromChallengeRating,
} from "./savingThrows";
