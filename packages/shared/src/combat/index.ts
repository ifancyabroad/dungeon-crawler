export { rollDice, rollD20, abilityModifier, computeUnarmoredAC } from "./dice";
export { resolveAttack } from "./resolveAttack";
export { applyDamageToActor, type DamageApplicationResult } from "./applyDamageToActor";
export { type AttackResult, type WeaponDice } from "./types";
export {
	computeSavingThrowDC,
	resolveSavingThrow,
	isActorProficientInSavingThrow,
	getActorProficiencyBonus,
	proficiencyBonusFromLevel,
	proficiencyBonusFromChallengeRating,
} from "./savingThrows";
