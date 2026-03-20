export { rollDice, rollD20, abilityModifier, computeUnarmoredAC } from "./dice";
export { resolveAttack } from "./combat";
export { UNARMED_WEAPON, type AttackResult, type WeaponDice } from "./types";
export { DAMAGE_TYPES, type DamageType } from "./damageTypes";
export {
	computeSavingThrowDC,
	resolveSavingThrow,
	isActorProficientInAbility,
	getActorProficiencyBonus,
	proficiencyBonusFromLevel,
	proficiencyBonusFromChallengeRating,
} from "./savingThrows";
