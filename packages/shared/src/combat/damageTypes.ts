/**
 * Damage types shared between content and the engine.
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
