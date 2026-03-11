/**
 * Zod schema and types for monster definitions.
 */

import { z } from "zod";
import { BaseAttributesSchema } from "./common.js";

export const MonsterSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
	baseAttributes: BaseAttributesSchema,
	hp: z.number(),
	armorClass: z.number(),
	tileId: z.number(),
	xpReward: z.number(),
});

export type MonsterDefinition = z.infer<typeof MonsterSchema>;

export type MonsterId = MonsterDefinition["id"];

export const MonstersArraySchema = z.array(MonsterSchema);
