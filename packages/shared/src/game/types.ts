/**
 * Game state types. JSON-serializable; no platform-specific imports.
 * No nested 2D arrays in persisted state; walkability computed at runtime when needed.
 */

import type { Action } from "./actions";
import type { AttackResult, DamagePacket } from "../combat/types";
import type { DamageType } from "../combat/damageTypes";
import type { MonsterAIState } from "./monsterAI";
import type { FloorConfig } from "../map/types";

export type TileId = number;

/** Per-floor map config. Re-exported from map/types for convenience. */
export type { FloorConfig } from "../map/types";

/** Opaque id for an actor (hero or monster). Hero uses constant "hero". */
export type ActorId = string;

/** Full attribute names (no abbreviations). */
export interface ActorAttributes {
	strength: number;
	dexterity: number;
	constitution: number;
	intelligence: number;
	wisdom: number;
	charisma: number;
}

/** Standard ability names for mapping saves. */
export type AbilityName = keyof ActorAttributes;

/** Per-skill state: optional level and cooldown. */
export interface ActorSkillState {
	level?: number;
	cooldownRemaining: number;
}

/**
 * A passive damage bonus stored on the actor.
 * Consulted during combat resolution to add extra damage packets.
 */
export interface PassiveDamageBonus {
	/** Dice expression, e.g. "1d6". */
	dice: string;
	damageType: DamageType;
	/** Which attack types this bonus applies to. */
	appliesTo: "melee" | "area" | "any";
	/** If true, only fires on a critical hit (melee only). */
	onCritOnly: boolean;
}

/**
 * A status effect currently active on an actor.
 * Each effect has a known id (e.g. "stealth") and a remaining turn count.
 * The engine decrements remainingTurns at the end of the actor's owning turn and removes it at 0.
 */
export interface ActiveEffect {
	/** Identifies the effect so engine systems can query it (e.g. "stealth"). */
	id: string;
	remainingTurns: number;
}

/** Definition reference: hero (classId from content) or monster. */
export type ActorDef = { type: "hero"; classId: string } | { type: "monster"; monsterId: string };

/** Data the caller provides to create the initial hero actor. Keeps the engine content-agnostic. */
export interface HeroInit {
	name: string;
	classId: string;
	hp: number;
	maxHp: number;
	armorClass?: number;
	attributes: ActorAttributes;
	level: number;
	xp: number;
	hitDie: number;
	/** Ability names this hero is proficient in for saving throws. */
	savingThrowProficiencies: AbilityName[];
	/** Skill ids to initialise on the hero (each gets cooldownRemaining: 0). */
	skills?: string[];
}

/** Data the caller provides to spawn a monster actor. Keeps the engine content-agnostic. */
export interface MonsterInit {
	monsterId: string;
	name: string;
	hp: number;
	maxHp: number;
	armorClass: number;
	attributes: ActorAttributes;
	damageResistances: DamageType[];
	damageImmunities: DamageType[];
	xpReward: number;
	/** Challenge rating used for monster proficiency scaling. */
	challengeRating: number;
	/** Ability names this monster is proficient in for saving throws. */
	savingThrowProficiencies: AbilityName[];
	aiStrategy: MonsterAIState["strategy"];
}

/** Actor: hero or monster. Use def.type for "hero" | "monster". Position is idx only; floor is implied by which floor's actorsById contains it. */
export interface Actor {
	id: string;
	name: string;
	idx: number;
	alive: boolean;
	hp: number;
	maxHp: number;
	armorClass: number;
	attributes: ActorAttributes;
	damageResistances: DamageType[];
	damageImmunities: DamageType[];
	skills: Record<string, ActorSkillState>;
	/** Active status effects (buffs/debuffs) currently applied to this actor. */
	statusEffects: ActiveEffect[];
	/**
	 * Passive damage bonuses applied permanently from passive skills.
	 * Consulted during resolveAttack, applyAreaDamage, applyChargeAttack.
	 */
	passiveDamageBonuses: PassiveDamageBonus[];
	/**
	 * Status effect ids the actor is immune to.
	 * applyStatus silently skips effects in this list.
	 */
	statusImmunities: string[];
	/** Ability names this actor is proficient in for saving throws. */
	savingThrowProficiencies: AbilityName[];
	/** Challenge Rating (monsters only). Used for monster proficiency bonus scaling. */
	challengeRating?: number;
	def: ActorDef;
	level: number;
	xp: number;
	hitDie: number;
	/** XP awarded to the killer when this actor dies. 0 for the hero. */
	xpReward: number;
	/** AI behaviour state. Undefined for the hero actor. */
	aiState?: MonsterAIState;
}

/** Events emitted during a turn for combat log and client feedback. */
export type GameEvent =
	| { type: "attack"; attackerId: ActorId; defenderId: ActorId; result: AttackResult }
	/**
	 * A physical hit triggered by a skill (e.g. Charge) rather than a standard WASD attack.
	 * Carries a full AttackResult (so miss/crit show correctly) but AttackAnimator ignores it,
	 * preventing a conflicting bump when the skill already animates movement.
	 */
	| {
			type: "skill_hit";
			attackerId: ActorId;
			defenderId: ActorId;
			skillId: string;
			result: AttackResult;
	  }
	| { type: "death"; actorId: ActorId }
	| { type: "level_up"; actorId: ActorId; newLevel: number; hpGained: number }
	| { type: "descend"; fromFloor: number; toFloor: number }
	| {
			type: "skill_used";
			actorId: ActorId;
			skillId: string;
			/** Tile index the skill was targeted at (tile-targeted skills). */
			targetTileIdx?: number;
			/** Actor id the skill was targeted at (actor-targeted skills). */
			targetActorId?: string;
	  }
	| { type: "status_applied"; actorId: ActorId; statusId: string; durationTurns: number }
	| {
			type: "saving_throw";
			casterId: ActorId;
			defenderId: ActorId;
			saveAbility: AbilityName;
			naturalRoll: number;
			abilityModifier: number;
			proficiencyBonusApplied: number;
			dc: number;
			totalRoll: number;
			success: boolean;
			auto: "auto_success" | "auto_fail" | "none";
	  }
	/** Damage from area-of-effect skills — no to-hit roll, always hits. */
	| {
			type: "area_hit";
			attackerId: ActorId;
			defenderId: ActorId;
			damage: number;
			damagePackets: DamagePacket[];
			skillId: string;
	  }
	| { type: "skill_granted"; actorId: ActorId; skillId: string };

export interface FloorState {
	tileOverrides: Record<string, TileId>;
	actorsById: Record<ActorId, Actor>;
	/** Flat array (length = width*height). 1 = tile has been seen at least once. Persisted. */
	explored: number[];
	/** Flat tile index of the spawn point for this floor. Set once at game creation. */
	spawnIdx: number;
	/** Flat tile index of the exit to the next floor. null on the final floor. */
	exitIdx: number | null;
}

/** Single floor: config + dynamic state. No parallel arrays. */
export interface Floor {
	config: FloorConfig;
	state: FloorState;
}

/** Concrete RNG state: serializable, Zod-validatable. Engine advances it in applyAction. */
export type RngState =
	| { algo: "xorshift32"; s: number }
	| { algo: "sfc32"; a: number; b: number; c: number; d: number };

export const MAP_GEN_VERSION = 2;

/**
 * Pending player interaction — when non-null, the game is "paused":
 * move/attack/use_skill actions are rejected until this is resolved.
 * Serialized into PersistedDynamicState so page refreshes correctly restore state.
 */
export type PendingInteraction = {
	type: "skill_choice";
	/** Whether the player is choosing an active or passive skill this level-up. */
	offerType: "active" | "passive";
	/** The level just reached. */
	levelReached: number;
	/** Up to 3 skill ids the player may pick from. */
	offers: string[];
	/** How many times the player has rerolled this offer set. */
	rerollsUsed: number;
} | null;

/** In-memory game state. No walkableByFloor; engine computes walkability when needed. */
export interface GameState {
	turn: number;
	heroId: ActorId;
	heroFloorIndex: number;
	seed: number;
	mapGenVersion: number;
	floors: Floor[];
	rngState: RngState;
	/**
	 * When non-null, the game is paused awaiting player interaction.
	 * Regular actions (move/attack/use_skill) are rejected by the engine.
	 * Extensible: add new union members for future interaction types (NPC dialogue, shrines, etc.).
	 */
	pendingInteraction: PendingInteraction;
}

// --- Persisted (no 2D arrays) ---

/** One document per game: metadata only. Configs only; no state. */
export interface GameSessionDoc {
	gameId: string;
	tokenHash: string;
	lastSeenAt: Date;
	userId: unknown | null;
	seed: number;
	mapGenVersion: number;
	floorConfigs: FloorConfig[];
	latestSnapshotTurn: number;
}

/** Dynamic state only. Snapshot stores floors[].state; session has floorConfigs; reconstruct zips by index. */
export interface PersistedDynamicState {
	turn: number;
	heroId: ActorId;
	heroFloorIndex: number;
	floors: FloorState[];
	rngState: RngState;
	pendingInteraction: PendingInteraction;
}

/** Action log: turn = state.turn BEFORE applying this action (expectedTurn). Unique (gameId, turn). */
export interface ActionLogEntry {
	gameId: string;
	/** Turn before apply; after apply state.turn === turn + 1. */
	turn: number;
	action: Action;
	stateHash?: string;
}

export interface GameSnapshotDoc {
	gameId: string;
	turn: number;
	state: PersistedDynamicState;
	createdAt: Date;
}
