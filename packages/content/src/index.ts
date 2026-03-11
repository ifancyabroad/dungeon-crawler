/**
 * Content package: validated JSON content (character classes, monsters, etc.) with typed lookup.
 * Import from "@app/content".
 */

export {
	characterClassIds,
	classes,
	classesById,
	contentVersion,
	monsterIds,
	monsters,
	monstersById,
	type CharacterClassId,
	type MonsterId,
} from "./generated/index.js";
export {
	CharacterClassSchema,
	CharacterClassesArraySchema,
	type CharacterClassDefinition,
} from "./schemas/characterClass.js";
export { MonsterSchema, MonstersArraySchema, type MonsterDefinition } from "./schemas/monster.js";
