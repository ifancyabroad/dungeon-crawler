/**
 * D&D 5e damage types.
 * Centralized here so both content + engine can share the same vocabulary.
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
