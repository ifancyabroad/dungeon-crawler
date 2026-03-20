/**
 * Skill schemas for content validation.
 *
 * All skill effect and definition schemas live in @app/shared — this file
 * re-exports them so buildContent.ts has a single local import path, and so
 * other content schemas can depend on this without importing from @app/shared
 * directly.
 */

import { z } from "zod";
import { SkillDefinitionSchema, type SkillDefinition } from "@app/shared";

export {
	ActiveSkillDefinitionSchema,
	ActiveSkillEffectDescriptorSchema,
	PassiveSkillDefinitionSchema,
	PassiveSkillEffectDescriptorSchema,
	SkillDefinitionSchema,
	type ActiveSkillDefinition,
	type ActiveSkillEffectDescriptor,
	type PassiveSkillDefinition,
	type PassiveSkillEffectDescriptor,
	type SkillDefinition,
} from "@app/shared";

export const SkillsArraySchema = z.array(SkillDefinitionSchema);
export type SkillId = SkillDefinition["id"];
