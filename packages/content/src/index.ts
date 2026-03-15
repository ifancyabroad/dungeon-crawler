/**
 * Content package: validated JSON content (character classes, monsters, vaults, encounters) with typed lookup.
 * Import from "@app/content".
 */

export {
	characterClassIds,
	classes,
	classesById,
	contentVersion,
	encounters,
	encountersById,
	monsterIds,
	monsters,
	monstersById,
	vaults,
	vaultsById,
	type CharacterClassId,
	type MonsterId,
} from "./generated/index.js";
export {
	CharacterClassSchema,
	CharacterClassesArraySchema,
	type CharacterClassDefinition,
} from "./schemas/characterClass.js";
export { MonsterSchema, MonstersArraySchema, type MonsterDefinition } from "./schemas/monster.js";
export { VaultDefSchema, VaultsArraySchema, type VaultDefinition } from "./schemas/vault.js";
export {
	EncounterDefSchema,
	EncountersArraySchema,
	type EncounterDefinition,
} from "./schemas/encounter.js";
