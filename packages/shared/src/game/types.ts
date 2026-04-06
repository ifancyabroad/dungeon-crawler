/**
 * Game state types. JSON-serializable; no platform-specific imports.
 * No nested 2D arrays in persisted state; walkability computed at runtime when needed.
 */

import type { Action } from "./actions";
import type { AttackResult, DamagePacket, WeaponDice } from "../combat/types";
import type { DamageType } from "../config/combat";
import type { NpcAIState } from "./strategies/types";
import type { FloorConfig } from "../map/types";
import type { CombatAdjustments } from "./schemas";
import type {
	EquipmentSlots,
	ItemInstance,
	LootDrop,
	LootTable,
	NaturalWeapon,
} from "../items/types";

export type { CombatAdjustments } from "./schemas";
export type {
	EquipmentSlots,
	ItemInstance,
	LootDrop,
	LootTable,
	NaturalWeapon,
} from "../items/types";

export type TileId = number;

/** Per-floor map config. Re-exported from map/types for convenience. */
export type { FloorConfig } from "../map/types";

/** Opaque id for an actor (hero or NPC). Hero uses constant "hero". */
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

/** Per-skill state: rank (1–3) and cooldown remaining. */
export interface ActorSkillState {
	rank: number;
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
	/** Which attack types this bonus applies to. "ranged" covers single-target skill attacks. */
	appliesTo: "melee" | "area" | "ranged" | "any";
	/** If true, only fires on a critical hit (melee only). */
	onCritOnly: boolean;
	/** Skill that applied this bonus. Used to replace entries when upgrading a passive skill. */
	sourceSkillId?: string;
	/** Item instance that applied this bonus. Used to remove entries when unequipping an item. */
	sourceItemInstanceId?: string;
	/** If set, only fires when the attack's primary damage type matches. */
	requiredDamageType?: DamageType;
}

/**
 * A flat (fixed integer) damage bonus stored on the actor.
 * Only fires when the attack's primary damage type matches this bonus's damageType,
 * enabling build synergy with specific weapons or spells.
 */
export interface PassiveFlatDamageBonus {
	amount: number;
	/** The damage type this bonus adds. */
	damageType: DamageType;
	/** Which attack types this bonus applies to. "ranged" covers single-target skill attacks. */
	appliesTo: "melee" | "area" | "ranged" | "any";
	/** Skill that applied this bonus. Used to replace entries when upgrading a passive skill. */
	sourceSkillId?: string;
	/** Item instance that applied this bonus. Used to remove entries when unequipping an item. */
	sourceItemInstanceId?: string;
	/** If set, only fires when the attack's primary damage type matches. */
	requiredDamageType?: DamageType;
}

/**
 * A status effect currently active on an actor.
 * Each effect has a known id (e.g. "stealth") and a remaining turn count.
 * The engine decrements remainingTurns at the end of the actor's owning turn and removes it at 0.
 *
 * `value` is an optional numeric parameter used by effects that need a magnitude,
 * such as damage-over-time (e.g. "poisoned" deals `value` damage per turn).
 *
 * `adjustments` carries inline numeric combat adjustments copied from the skill JSON
 * at application time (data-driven statuses only, e.g. berserk). ID-driven hooks
 * such as poisoned and stealth leave this undefined — their behaviour is wired
 * directly in the engine (activeEffects.ts).
 */
export interface ActiveEffect {
	/** Identifies the effect so engine systems can query it (e.g. "stealth"). */
	id: string;
	remainingTurns: number;
	/** Optional magnitude for parameterised effects (e.g. damage per turn for DoT). */
	value?: number;
	/** Inline numeric combat adjustments consulted at resolution time. Defined in the skill JSON. */
	adjustments?: CombatAdjustments;
	/**
	 * The skill that applied this effect. Set for data-driven statuses applied via
	 * `apply_status` effect descriptors. Undefined for STATUS_HOOKS applied directly
	 * by the engine (e.g. environmental effects, NPC attacks).
	 */
	sourceSkillId?: string;
}

/** Definition reference: hero (classId from content) or NPC (npcId from content). */
export type ActorDef = { type: "hero"; classId: string } | { type: "npc"; npcId: string };

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
	/** Skills to initialise on the hero (each gets cooldownRemaining: 0). */
	skills?: { id: string; rank: number }[];
	/** Starting equipment slot assignments (item IDs). Applied by the API layer after actor creation. */
	equipment: EquipmentSlots;
	weaponProficiencies: string[];
	armorProficiencies: string[];
}

/** Data the caller provides to spawn an NPC actor. Keeps the engine content-agnostic. */
export interface NpcInit {
	npcId: string;
	name: string;
	/** Combat alignment. Assigned directly to Actor.faction — no derivation. */
	faction: "player" | "hostile";
	/** Behavioral/spawn category. Stored on the actor for future systems; no combat effect. */
	role: "grunt" | "boss" | "mercenary" | "vendor";
	hp: number;
	maxHp: number;
	armorClass: number;
	attributes: ActorAttributes;
	damageResistances: DamageType[];
	damageImmunities: DamageType[];
	damageVulnerabilities: DamageType[];
	xpReward: number;
	/** Challenge rating used for NPC proficiency scaling. */
	challengeRating: number;
	/** Ability names this NPC is proficient in for saving throws. */
	savingThrowProficiencies: AbilityName[];
	combatStrategy: NpcAIState["combatStrategy"];
	idleStrategy: NpcAIState["idleStrategy"];
	/** Active skills this NPC spawns with. Each starts with cooldownRemaining: 0. */
	activeSkills: { id: string; rank: number }[];
	/** Passive skills this NPC spawns with. Applied by the caller via applyPassiveEffect before the actor enters the floor. */
	passiveSkills: { id: string; rank: number }[];
	/** Starting equipment slot assignments (item IDs). Applied by the API layer after actor creation. */
	equipment: EquipmentSlots;
	weaponProficiencies: string[];
	armorProficiencies: string[];
	/** Innate attack (bite, claws, etc.) — used when no weapon is equipped. Always proficient. */
	naturalWeapon?: NaturalWeapon;
	/** Loot table evaluated on death. Undefined for the hero. */
	lootTable?: LootTable;
}

/** Actor: hero or NPC. Use def.type to distinguish ("hero" | "npc"). Position is idx only; floor is implied by which floor's actorsById contains it. */
export interface Actor {
	id: string;
	name: string;
	idx: number;
	alive: boolean;
	hp: number;
	maxHp: number;
	armorClass: number;
	attributes: ActorAttributes;
	/** Raw equipment slot data (item IDs). Applied by the API layer; stored for reference (e.g. UI). */
	equipment: EquipmentSlots;
	weaponProficiencies: string[];
	armorProficiencies: string[];
	/** Innate attack for beasts/monsters. Undefined for heroes and humanoid NPCs. */
	naturalWeapon?: NaturalWeapon;
	/**
	 * Pre-resolved at equipment-application time. Avoids item lookup in the combat hot path.
	 * Defaults to UNARMED_WEAPON at actor creation; overridden by applyEquipment in the API layer.
	 */
	equippedWeaponDice: WeaponDice;
	/** Which ability drives attack and damage rolls. "strength" for most weapons; "dexterity" for natural attacks with attackStat: "dexterity". */
	equippedAttackStat: "strength" | "dexterity";
	/** True if the weapon has the finesse property — attack uses max(STR, DEX) modifier. */
	equippedWeaponFinesse: boolean;
	/** True if proficient with equipped weapon — proficiency bonus is added to attack rolls. */
	weaponProficient: boolean;
	/** True if proficient with equipped body armor — active skills are blocked if false. */
	armorProficient: boolean;
	damageResistances: DamageType[];
	damageImmunities: DamageType[];
	/** Damage types this actor takes double damage from. Applied after resistance/immunity checks. */
	damageVulnerabilities: DamageType[];
	skills: Record<string, ActorSkillState>;
	/**
	 * All timed effects currently active on this actor — both buff-type effects
	 * (berserk, stealth) and condition-type effects (poisoned). The engine uses
	 * separate registries (statusCombatModifiers, DOT_EFFECT_IDS) to determine
	 * what each effect id actually does; the data structure is the same for all.
	 */
	activeEffects: ActiveEffect[];
	/**
	 * Named numeric resources that change independently of turn counting.
	 * Use this instead of adding ad-hoc optional fields to Actor.
	 *
	 * Known keys:
	 *   "shieldHp" — hit points absorbed by the Shield skill before HP is reduced.
	 *
	 * Future examples: mana, devotion, ward stacks.
	 */
	numericBuffs: Record<string, number>;
	/**
	 * Passive damage bonuses applied permanently from passive skills.
	 * Consulted during resolveAttack, applyAreaDamage, applyChargeAttack.
	 */
	passiveDamageBonuses: PassiveDamageBonus[];
	/**
	 * Flat (fixed integer) damage bonuses applied from passive skills.
	 * Each bonus fires unconditionally or, if requiredDamageType is set, only when the attack's
	 * primary damage type matches.
	 */
	passiveFlatDamageBonuses: PassiveFlatDamageBonus[];
	/**
	 * Status effect ids the actor is immune to.
	 * applyStatus silently skips effects in this list.
	 */
	statusImmunities: string[];
	/** Ability names this actor is proficient in for saving throws. */
	savingThrowProficiencies: AbilityName[];
	/** Challenge Rating (NPCs only). Used for NPC proficiency bonus scaling. */
	challengeRating?: number;
	/**
	 * Natural roll threshold for a critical hit. Defaults to 20.
	 * The modify_crit_threshold passive lowers this (e.g. 19 = crit on 19 or 20).
	 */
	critThreshold?: number;
	/**
	 * Flat bonus added to every attack roll.
	 * Set by the add_attack_roll_bonus passive; stacks additively across multiple passives.
	 */
	attackBonusFlat?: number;
	/**
	 * Flat bonus added to all healing the actor performs (heal_self, heal_target, drain_life, HoT).
	 * Set by the add_healing_bonus_flat passive; stacks additively.
	 */
	healingBonusFlat?: number;
	/**
	 * Flat amount added to the `value` of any DoT (damage-over-time) effect the actor applies.
	 * Set by the add_dot_amplify_flat passive; stacks additively.
	 */
	dotAmplifyFlat?: number;
	/**
	 * Faction tag: "player" = hero/allied side; "hostile" = enemy side.
	 * Defaults: hero → "player", hostile NPCs → "hostile".
	 * CHARMED status temporarily flips a hostile's effective faction for AI targeting only.
	 */
	faction?: "player" | "hostile";
	def: ActorDef;
	level: number;
	xp: number;
	hitDie: number;
	/** XP awarded to the killer when this actor dies. 0 for the hero. */
	xpReward: number;
	/** AI behaviour state. Undefined for the hero actor. */
	aiState?: NpcAIState;
	/** Gold carried by this actor. Hero only — NPCs drop gold via lootTable, not this field. */
	gold: number;
	/** Item instances owned by this actor, keyed by instanceId. Populated when items are looted. */
	itemInstances: Record<string, ItemInstance>;
	/**
	 * Flat attack roll bonus contributed by equipped items (enhancement bonus + attack-roll affixes).
	 * Overwritten on every applyEquipment call. Distinct from attackBonusFlat (skill-sourced).
	 */
	itemAttackBonusFlat: number;
	/**
	 * Flat AC bonus contributed by equipped item affixes (e.g. Reinforced affix).
	 * Overwritten on every applyEquipment call. Added to armorClass after base AC computation.
	 */
	itemAcBonus: number;
	/** Loot table evaluated when this actor dies. Undefined for the hero. */
	lootTable?: LootTable;
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
			/**
			 * Tile index of the target actor at the moment of casting, snapshotted before
			 * enemy turns run. Handlers must use this (not the store) to position animations
			 * so projectiles fly to where the target was hit, not where they ended up.
			 */
			targetActorIdx?: number;
	  }
	| { type: "status_applied"; actorId: ActorId; statusId: string; durationTurns: number }
	/** Emitted when a status effect is removed from an actor by a cleanse/dispel effect. */
	| { type: "status_removed"; actorId: ActorId; statusId: string }
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
	/**
	 * A skill attack roll that missed — emitted by single_target_damage when
	 * attackRoll is configured and the roll does not meet the target's AC.
	 */
	| {
			type: "skill_miss";
			attackerId: ActorId;
			defenderId: ActorId;
			skillId: string;
			naturalRoll: number;
			totalRoll: number;
			targetAc: number;
	  }
	| { type: "skill_granted"; actorId: ActorId; skillId: string }
	/** Emitted when incoming damage is absorbed by a shield before hitting HP. */
	| {
			type: "shield_absorbed";
			actorId: ActorId;
			absorbed: number;
			shieldHpRemaining: number;
	  }
	/** Emitted each turn a damage-over-time status condition deals damage. */
	| {
			type: "dot_damage";
			actorId: ActorId;
			statusId: string;
			damage: number;
	  }
	/** Emitted when an actor recovers HP (heal_self, heal_target, drain_life, regenerating). */
	| {
			type: "healed";
			actorId: ActorId;
			amount: number;
			skillId: string;
	  }
	/** Emitted when push_actor displaces a target. Used by the client for move animation. */
	| {
			type: "actor_pushed";
			actorId: ActorId;
			fromIdx: number;
			toIdx: number;
			skillId: string;
	  }
	/** Emitted when teleport_swap swaps positions of caster and target. */
	| {
			type: "teleport_swap";
			casterId: ActorId;
			targetId: ActorId;
			casterNewIdx: number;
			targetNewIdx: number;
			skillId: string;
	  }
	/** Emitted when an NPC dies and produces a loot drop on its tile. */
	| { type: "loot_dropped"; tileIdx: number; loot: LootDrop }
	/** Emitted when the hero collects gold (auto-collect on gold-only tile, or via pickup_gold action). */
	| { type: "gold_collected"; actorId: ActorId; amount: number; tileIdx: number }
	/** Emitted when the hero equips an item from a loot pile. */
	| { type: "item_looted"; actorId: ActorId; item: ItemInstance; slot: string };

/**
 * The subset of `GameEvent` that represents direct damage output from a skill cast:
 * a hit on a single target (`skill_hit`) or an area-of-effect hit (`area_hit`).
 * Both carry `attackerId`, which is the casting actor.
 *
 * Use `isSkillDamageEvent` to narrow `GameEvent` to this type. This lets consumers
 * identify which events belong to a specific skill cast without hardcoding type names.
 */
export type SkillDamageEvent = Extract<GameEvent, { type: "skill_hit" | "area_hit" }>;

/**
 * Type guard: returns true when `e` is a direct damage output of a skill cast
 * (`skill_hit` or `area_hit`). The `attackerId` field on the narrowed type is the caster.
 */
export function isSkillDamageEvent(e: GameEvent): e is SkillDamageEvent {
	return e.type === "skill_hit" || e.type === "area_hit";
}

export interface FloorState {
	tileOverrides: Record<string, TileId>;
	actorsById: Record<ActorId, Actor>;
	/** Flat array (length = width*height). 1 = tile has been seen at least once. Persisted. */
	explored: number[];
	/** Flat tile index of the spawn point for this floor. Set once at game creation. */
	spawnIdx: number;
	/** Flat tile index of the exit to the next floor. null on the final floor. */
	exitIdx: number | null;
	/**
	 * Loot drops on this floor, keyed by flat tile index (as string).
	 * Populated when an NPC dies with a loot table. Cleared when the hero picks up all items
	 * or leaves the pile. The corresponding tileOverrides entry (tile 825 or 827) is kept in sync.
	 */
	lootByIdx: Record<string, LootDrop>;
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

/** A single skill offer presented at level-up (new skill or upgrade to an existing one). */
export interface SkillOffer {
	skillId: string;
	/** The rank that will be granted when this offer is selected. 1 = new skill, 2–3 = upgrade. */
	rank: number;
}

/**
 * Pending player interaction — when non-null, the game is "paused":
 * move/attack/use_skill actions are rejected until this is resolved.
 * Serialized into PersistedDynamicState so page refreshes correctly restore state.
 */
export type PendingInteraction =
	| {
			type: "skill_choice";
			/** The level just reached. */
			levelReached: number;
			/** Max HP gained from the level-up roll. */
			hpGained: number;
			/** Mixed active and passive offers. Each entry carries the skill id and rank to grant. */
			offers: SkillOffer[];
			/** How many times the player has rerolled this offer set. */
			rerollsUsed: number;
			/** Gold cost to reroll the current offer. Flat 15 per reroll. */
			rerollCost: number;
	  }
	| {
			type: "loot_pickup";
			/** Flat tile index of the loot pile. */
			tileIdx: number;
			/** Current contents of the pile (updated as items are taken). */
			loot: LootDrop;
	  }
	| null;

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
