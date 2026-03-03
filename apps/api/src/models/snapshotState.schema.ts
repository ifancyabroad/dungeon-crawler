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
		level: Number,
		cooldownRemaining: Number,
	},
	{ _id: false },
);

const ActorDefSchema = new Schema(
	{
		type: { type: String, required: true },
		classId: String,
		monsterId: String,
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
		attributes: ActorAttributesSchema,
		skills: { type: Map, of: ActorSkillStateSchema, default: () => new Map() },
		def: ActorDefSchema,
	},
	{ _id: false },
);

const FloorStateSchema = new Schema(
	{
		tileOverrides: { type: Map, of: Number, default: () => new Map() },
		actorsById: { type: Map, of: ActorSchema, default: () => new Map() },
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
