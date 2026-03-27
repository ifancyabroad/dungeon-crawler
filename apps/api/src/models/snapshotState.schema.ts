/**
 * Mongoose nested schema for snapshot state. Mirrors @app/shared PersistedDynamicState
 * so we do not use Schema.Types.Mixed; Mongoose then preserves the full structure on round-trip.
 *
 * IMPORTANT: This schema must be kept in sync with the Zod schemas in
 * packages/shared/src/game/schemas.ts. When adding fields to Actor, FloorState, or
 * PersistedDynamicState, add them here too — Mongoose silently strips unknown fields
 * (strict mode), so omissions cause silent data loss on snapshot save/reload.
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

/** Inline { damageType, amount } object used by CombatAdjustments flat damage fields. */
const DamageFlatSchema = new Schema(
	{
		damageType: { type: String, required: true },
		amount: { type: Number, required: true },
	},
	{ _id: false },
);

/** Mirrors CombatAdjustmentsSchema in packages/shared/src/game/schemas.ts. */
const CombatAdjustmentsSchema = new Schema(
	{
		meleeDamageFlat: { type: DamageFlatSchema, default: undefined },
		incomingDamageFlat: Number,
		attackRollDiceBonus: String,
		attackRollDicePenalty: String,
		savingThrowDiceBonus: String,
		savingThrowDicePenalty: String,
		acBonus: Number,
		rangedDamageFlat: { type: DamageFlatSchema, default: undefined },
		areaDamageFlat: { type: DamageFlatSchema, default: undefined },
		hasAdvantage: Boolean,
		hasDisadvantage: Boolean,
		meleeDamageDiceBonus: String,
		rangedDamageDiceBonus: String,
		areaDamageDiceBonus: String,
		critThresholdReduction: Number,
		saveDcBonusFlat: Number,
		healingDoneFlat: Number,
	},
	{ _id: false },
);

/** Mirrors ActiveEffectSchema in packages/shared/src/game/schemas.ts. */
const ActiveEffectSchema = new Schema(
	{
		id: { type: String, required: true },
		remainingTurns: { type: Number, required: true },
		value: Number,
		adjustments: { type: CombatAdjustmentsSchema, default: undefined },
	},
	{ _id: false },
);

/** Mirrors PassiveDamageBonusSchema in packages/shared/src/game/schemas.ts. */
const PassiveDamageBonusSchema = new Schema(
	{
		dice: { type: String, required: true },
		damageType: { type: String, required: true },
		appliesTo: { type: String, required: true },
		onCritOnly: { type: Boolean, required: true },
		sourceSkillId: String,
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
		damageResistances: [String],
		damageImmunities: [String],
		damageVulnerabilities: [String],
		skills: { type: Map, of: ActorSkillStateSchema },
		activeEffects: [ActiveEffectSchema],
		numericBuffs: { type: Map, of: Number },
		passiveDamageBonuses: [PassiveDamageBonusSchema],
		statusImmunities: [String],
		def: ActorDefSchema,
		level: Number,
		xp: Number,
		hitDie: Number,
		xpReward: Number,
		aiState: { type: NpcAIStateSchema, default: undefined },
		savingThrowProficiencies: [String],
		challengeRating: Number,
		equipment: EquipmentSlotsSchema,
		weaponProficiencies: [String],
		armorProficiencies: [String],
		naturalWeapon: { type: NaturalWeaponSchema, default: undefined },
		equippedWeaponDice: { type: WeaponDiceSchema, required: true },
		equippedAttackStat: { type: String, required: true },
		equippedWeaponFinesse: { type: Boolean, required: true },
		weaponProficient: { type: Boolean, required: true },
		dotAmplifyFlat: Number,
		attackBonusFlat: Number,
		healingBonusFlat: Number,
		critThreshold: Number,
		faction: String,
	},
	{ _id: false },
);

const FloorStateSchema = new Schema(
	{
		tileOverrides: { type: Map, of: Number },
		actorsById: { type: Map, of: ActorSchema },
		explored: [Number],
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

const SkillOfferSchema = new Schema(
	{
		skillId: { type: String, required: true },
		rank: { type: Number, required: true },
	},
	{ _id: false },
);

/**
 * Nullable pending skill-choice interaction. Stored as null when no choice is pending.
 * Default null handles snapshots written before this field existed.
 */
const PendingInteractionSchema = new Schema(
	{
		type: { type: String, required: true },
		levelReached: { type: Number, required: true },
		offers: [SkillOfferSchema],
		rerollsUsed: { type: Number, required: true },
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
		pendingInteraction: { type: PendingInteractionSchema, default: null },
	},
	{ _id: false },
);
