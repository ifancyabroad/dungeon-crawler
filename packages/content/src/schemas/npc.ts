/**
 * Zod schema and types for NPC definitions.
 * Covers all non-player actors: hostile monsters, bosses, mercenaries, and friendly NPCs.
 */

import { z } from "zod";
import {
	AbilityNameSchema,
	ActorAttributesSchema as BaseAttributesSchema,
	DAMAGE_TYPES,
} from "@app/shared";

type DamageType = (typeof DAMAGE_TYPES)[number];
const DamageTypeSchema = z.enum(DAMAGE_TYPES as unknown as [DamageType, ...DamageType[]]);

export const NpcSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
	/**
	 * Combat alignment. Passed directly to Actor.faction at spawn — no derivation.
	 * "hostile" = fights the player; "player" = fights alongside the player.
	 */
	faction: z.enum(["player", "hostile"]),
	/**
	 * Behavioral/spawn category. Has no combat implication; drives future systems
	 * such as hire dialogs (mercenary), shop UI (vendor), and boss spawn rules (boss).
	 * Authors set this independently of faction.
	 */
	role: z.enum(["grunt", "boss", "mercenary", "vendor"]),
	baseAttributes: BaseAttributesSchema,
	hp: z.number(),
	armorClass: z.number(),
	tileId: z.number(),
	xpReward: z.number(),
	combatStrategy: z.enum(["melee", "ranged", "skirmisher"]),
	/** Idle behaviour when the NPC has no enemies to fight. Defaults to stationary. */
	idleStrategy: z.enum(["stationary", "roam", "follow"]).default("stationary"),
	/** Challenge rating used to approximate NPC proficiency bonus. */
	challengeRating: z.number(),
	/** Saving throw proficiencies this NPC is trained in. */
	savingThrowProficiencies: z.array(AbilityNameSchema),
	damageResistances: z.array(DamageTypeSchema).default([]),
	damageImmunities: z.array(DamageTypeSchema).default([]),
	damageVulnerabilities: z.array(DamageTypeSchema).default([]),
	/** CSS hex colour for blood/death particle effects. */
	bloodColor: z.string(),
	/** Active skills this NPC spawns with. Each entry specifies the skill id and its rank (1–3). */
	activeSkills: z
		.array(z.object({ id: z.string(), rank: z.number().int().min(1).max(3) }))
		.default([]),
	/** Passive skills this NPC spawns with. Applied via applyPassiveEffect at spawn time. */
	passiveSkills: z
		.array(z.object({ id: z.string(), rank: z.number().int().min(1).max(3) }))
		.default([]),
	/** Item IDs equipped on spawn. Resolved to EquipmentSlots via buildEquipmentSlots at spawn time. */
	startingEquipment: z.array(z.string()).default([]),
	/** Weapon categories this NPC is proficient with (adds proficiency bonus to attack rolls). */
	weaponProficiencies: z.array(z.string()).default([]),
	/** Armor categories this NPC is proficient with. */
	armorProficiencies: z.array(z.string()).default([]),
	/**
	 * Innate attack used when no weapon is equipped in the main-hand slot.
	 * Always treated as proficient. Overridden by applyEquipment if startingEquipment
	 * contains a weapon.
	 */
	naturalWeapon: z
		.object({
			name: z.string(),
			/** Dice expression, e.g. "1d4". Consistent with skill JSON format. */
			damageDice: z.string(),
			damageType: DamageTypeSchema,
			attackStat: z.enum(["strength", "dexterity"]).default("strength"),
		})
		.optional(),
	/** Loot table rolled on death. If absent, the NPC drops nothing. */
	lootTable: z
		.object({
			dropChance: z.number().min(0).max(1),
			gold: z.object({ min: z.number(), max: z.number() }).optional(),
			items: z.array(z.object({ baseItemId: z.string(), weight: z.number() })).optional(),
			rarityWeights: z
				.record(z.enum(["common", "uncommon", "rare", "epic", "unique"]), z.number())
				.optional(),
		})
		.optional(),
});

export type NpcDefinition = z.infer<typeof NpcSchema>;

export type NpcId = NpcDefinition["id"];

export const NpcsArraySchema = z.array(NpcSchema);
