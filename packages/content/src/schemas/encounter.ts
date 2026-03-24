/**
 * Zod schema and types for encounter definitions.
 */

import { z } from "zod";

export const EncounterEntrySchema = z.object({
	npcId: z.string(),
	count: z.number().int().positive(),
	weight: z.number().positive(),
});

export const EncounterDefSchema = z.object({
	id: z.string(),
	minDepth: z.number().int().positive().optional(),
	entries: z.array(EncounterEntrySchema),
});

export type EncounterDefinition = z.infer<typeof EncounterDefSchema>;

export const EncountersArraySchema = z.array(EncounterDefSchema);
