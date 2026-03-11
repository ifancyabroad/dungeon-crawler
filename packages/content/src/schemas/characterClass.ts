/**
 * Zod schema and types for character class definitions.
 */

import { z } from "zod";
import { BaseAttributesSchema } from "./common.js";

const ResourceSchema = z.enum(["mana", "stamina", "none"]);

export const CharacterClassSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
	baseAttributes: BaseAttributesSchema,
	startingHp: z.number(),
	startingEquipment: z.array(z.string()),
	startingSkills: z.array(z.string()),
	weaponProficiencies: z.array(z.string()),
	armorProficiencies: z.array(z.string()),
	resource: ResourceSchema,
	tileId: z.number(),
});

export type CharacterClassDefinition = z.infer<typeof CharacterClassSchema>;

export type CharacterClassId = CharacterClassDefinition["id"];

export const CharacterClassesArraySchema = z.array(CharacterClassSchema);
