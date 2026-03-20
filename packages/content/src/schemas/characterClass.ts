/**
 * Zod schema and types for character class definitions.
 */

import { z } from "zod";
import { AbilityNameSchema, ActorAttributesSchema as BaseAttributesSchema } from "@app/shared";

const ResourceSchema = z.enum(["mana", "stamina", "none"]);

export const CharacterClassSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
	baseAttributes: BaseAttributesSchema,
	startingHp: z.number(),
	hitDie: z.number(),
	startingEquipment: z.array(z.string()),
	startingSkills: z.array(z.string()),
	/**
	 * Active skills available in the level-up offer pool for this class.
	 * Starting skills are granted automatically and excluded from offers.
	 */
	activeSkillPool: z.array(z.string()),
	/**
	 * Passive skills available in the level-up offer pool for this class.
	 */
	passiveSkillPool: z.array(z.string()),
	weaponProficiencies: z.array(z.string()),
	armorProficiencies: z.array(z.string()),
	/** Saving throw proficiencies this class is trained in. */
	savingThrowProficiencies: z.array(AbilityNameSchema),
	resource: ResourceSchema,
	tileId: z.number(),
});

export type CharacterClassDefinition = z.infer<typeof CharacterClassSchema>;

export type CharacterClassId = CharacterClassDefinition["id"];

export const CharacterClassesArraySchema = z.array(CharacterClassSchema);
