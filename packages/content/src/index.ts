/**
 * Content package: validated JSON content (character classes, NPCs, vaults, encounters) with typed lookup.
 * Import from "@app/content".
 */

export {
	affixIds,
	affixes,
	affixesById,
	characterClassIds,
	classes,
	classesById,
	contentVersion,
	encounters,
	encountersById,
	itemIds,
	items,
	itemsById,
	npcIds,
	npcs,
	npcsById,
	skillIds,
	skills,
	skillsById,
	vaults,
	vaultsById,
	type AffixId,
	type CharacterClassId,
	type ItemId,
	type NpcId,
	type SkillId,
} from "./generated/index.js";
export {
	CharacterClassSchema,
	CharacterClassesArraySchema,
	type CharacterClassDefinition,
} from "./schemas/characterClass.js";
export { NpcSchema, NpcsArraySchema, type NpcDefinition } from "./schemas/npc.js";
export { VaultDefSchema, VaultsArraySchema, type VaultDefinition } from "./schemas/vault.js";
export {
	EncounterDefSchema,
	EncountersArraySchema,
	type EncounterDefinition,
} from "./schemas/encounter.js";
export {
	ActiveSkillDefinitionSchema,
	ActiveSkillEffectDescriptorSchema,
	PassiveSkillDefinitionSchema,
	PassiveSkillEffectDescriptorSchema,
	SkillDefinitionSchema,
	SkillsArraySchema,
	type ActiveSkillDefinition,
	type ActiveSkillEffectDescriptor,
	type PassiveSkillDefinition,
	type PassiveSkillEffectDescriptor,
	type SkillDefinition,
} from "./schemas/skill.js";
export {
	ItemSchema,
	ItemsArraySchema,
	WeaponItemSchema,
	ArmorItemSchema,
	ShieldItemSchema,
	AccessoryItemSchema,
	type ItemDefinition,
} from "./schemas/item.js";
export { AffixSchema, type AffixDefinition } from "./schemas/affix.js";
