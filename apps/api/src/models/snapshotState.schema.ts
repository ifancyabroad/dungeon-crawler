/**
 * Mongoose nested schema for snapshot state. Mirrors @app/shared PersistedDynamicState
 * so we do not use Schema.Types.Mixed; Mongoose then preserves the full structure on round-trip.
 */

import { Schema } from "mongoose";

const ActorAttributesSchema = new Schema(
	{
		strength: Number,
		dexterity: Number,
		constitution: Number,
		intelligence: Number,
		wisdom: Number,
		charisma: Number,
	},
	{ _id: false },
);

const ActorSkillStateSchema = new Schema(
	{
		rank: { type: Number, required: true },
		cooldownRemaining: { type: Number, required: true },
	},
	{ _id: false },
);

const ActorDefSchema = new Schema(
	{
		type: { type: String, required: true },
		classId: String,
		npcId: String,
	},
	{ _id: false },
);

const NpcAIStateSchema = new Schema(
	{
		combatStrategy: { type: String, required: true },
		idleStrategy: { type: String, required: true },
		lastKnownEnemyIdx: Number,
		followTargetId: String,
	},
	{ _id: false },
);

const EquipmentSlotsSchema = new Schema(
	{
		mainHand: String,
		offHand: String,
		armor: String,
		ring: String,
	},
	{ _id: false },
);

const WeaponDiceSchema = new Schema(
	{
		dice: { type: String, required: true },
		damageType: { type: String, required: true },
	},
	{ _id: false },
);

const NaturalWeaponSchema = new Schema(
	{
		name: { type: String, required: true },
		damageDice: { type: String, required: true },
		damageType: { type: String, required: true },
		attackStat: { type: String, required: true },
	},
	{ _id: false },
);

const ActorSchema = new Schema(
	{
		id: String,
		name: String,
		idx: Number,
		alive: Boolean,
		hp: Number,
		maxHp: Number,
		armorClass: Number,
		attributes: ActorAttributesSchema,
		damageResistances: { type: [String], default: [] },
		damageImmunities: { type: [String], default: [] },
		skills: { type: Map, of: ActorSkillStateSchema, default: () => new Map() },
		def: ActorDefSchema,
		level: Number,
		xp: Number,
		hitDie: Number,
		xpReward: Number,
		aiState: { type: NpcAIStateSchema, default: undefined },
		savingThrowProficiencies: { type: [String], default: [] },
		challengeRating: { type: Number, default: undefined },
		equipment: { type: EquipmentSlotsSchema, default: () => ({}) },
		weaponProficiencies: { type: [String], default: [] },
		armorProficiencies: { type: [String], default: [] },
		naturalWeapon: { type: NaturalWeaponSchema, default: undefined },
		equippedWeaponDice: { type: WeaponDiceSchema, required: true },
		equippedAttackStat: { type: String, required: true },
		equippedWeaponFinesse: { type: Boolean, required: true },
		weaponProficient: { type: Boolean, required: true },
	},
	{ _id: false },
);

const FloorStateSchema = new Schema(
	{
		tileOverrides: { type: Map, of: Number, default: () => new Map() },
		actorsById: { type: Map, of: ActorSchema, default: () => new Map() },
		explored: { type: [Number], default: [] },
		spawnIdx: { type: Number, required: true },
		exitIdx: { type: Number, default: null },
	},
	{ _id: false },
);

const RngStateSchema = new Schema(
	{
		algo: { type: String, required: true },
		s: Number,
		a: Number,
		b: Number,
		c: Number,
		d: Number,
	},
	{ _id: false },
);

/** Nested schema for snapshot.state. Use this instead of Mixed so structure is preserved. */
export const SnapshotStateSchema = new Schema(
	{
		turn: { type: Number, required: true },
		heroId: { type: String, required: true },
		heroFloorIndex: { type: Number, required: true },
		floors: { type: [FloorStateSchema], required: true },
		rngState: { type: RngStateSchema, required: true },
	},
	{ _id: false },
);
