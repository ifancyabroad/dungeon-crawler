import type { AbilityName } from "@app/shared";

/** Canonical order for attribute rows (e.g. character sheet sidebar). */
export const ABILITY_ORDER: readonly AbilityName[] = [
	"strength",
	"dexterity",
	"constitution",
	"intelligence",
	"wisdom",
	"charisma",
] as const;

/** Short UI labels (Str, Dex, …). */
export const ABILITY_SHORT_LABELS: Record<AbilityName, string> = {
	strength: "Str",
	dexterity: "Dex",
	constitution: "Con",
	intelligence: "Int",
	wisdom: "Wis",
	charisma: "Cha",
};

/** `{ key, label }` pairs in display order — for grids and lists. */
export const ABILITY_SHORT_LABELS_ORDERED: { key: AbilityName; label: string }[] =
	ABILITY_ORDER.map((key) => ({ key, label: ABILITY_SHORT_LABELS[key] }));
