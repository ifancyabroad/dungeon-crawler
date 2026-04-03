/**
 * Zod schema and types for affix definitions.
 * Affixes are bonus properties attached to item instances at generation time.
 *
 * Re-exports AffixDef from @app/shared so buildContent.ts has a single
 * local import path, consistent with the item.ts schema pattern.
 */

import { z } from "zod";
import { PassiveSkillEffectDescriptorSchema } from "@app/shared";

export type { AffixDef } from "@app/shared";

export const AffixSchema = z.object({
	id: z.string(),
	name: z.string(),
	namePrefix: z.string().optional(),
	nameSuffix: z.string().optional(),
	namePriority: z.number(),
	eligibleItemTypes: z.array(z.enum(["weapon", "armor", "shield", "accessory"])),
	effect: PassiveSkillEffectDescriptorSchema,
});

export type AffixDefinition = z.infer<typeof AffixSchema>;
