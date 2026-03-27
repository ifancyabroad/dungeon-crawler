/**
 * Combat rules literals — single place to tune DCs, proficiency, damage types, defaults.
 */

export const DAMAGE_TYPES = [
	"acid",
	"bludgeoning",
	"cold",
	"fire",
	"force",
	"lightning",
	"necrotic",
	"piercing",
	"poison",
	"psychic",
	"radiant",
	"slashing",
	"thunder",
] as const;

export type DamageType = (typeof DAMAGE_TYPES)[number];

/** Default unarmed weapon: 1d4 bludgeoning. */
export const UNARMED_WEAPON = {
	dice: "1d4",
	damageType: "bludgeoning" as DamageType,
};

export const COMBAT_CONFIG = {
	damageTypes: DAMAGE_TYPES,
	defaults: {
		unarmedWeapon: UNARMED_WEAPON,
	},
	rules: {
		resistanceDivisor: 2,
		saveDcBase: 8,
		naturalRollAutoSuccess: 20,
		naturalRollAutoFail: 1,
	},
	proficiency: {
		levelThresholds: [
			{ min: 17, bonus: 6 },
			{ min: 13, bonus: 5 },
			{ min: 9, bonus: 4 },
			{ min: 5, bonus: 3 },
			{ min: 1, bonus: 2 },
		] as const,
		challengeRatingThresholds: [
			{ min: 29, bonus: 9 },
			{ min: 25, bonus: 8 },
			{ min: 21, bonus: 7 },
			{ min: 17, bonus: 6 },
			{ min: 13, bonus: 5 },
			{ min: 9, bonus: 4 },
			{ min: 5, bonus: 3 },
			{ min: 0, bonus: 2 },
		] as const,
	},
} as const;
