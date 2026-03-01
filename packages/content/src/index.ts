/**
 * Content package: validated JSON content (character classes, etc.) with typed lookup.
 * Import from "@app/content".
 */

export {
	characterClassIds,
	classes,
	classesById,
	contentVersion,
	type CharacterClassId,
} from "./generated/index.js";
export {
	CharacterClassSchema,
	CharacterClassesArraySchema,
	type CharacterClassDefinition,
} from "./schemas/characterClass.js";
