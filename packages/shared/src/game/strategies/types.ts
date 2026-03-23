/**
 * Shared types for monster AI strategies.
 * Kept separate from the registry so individual strategy files can import
 * these types without creating a circular dependency with strategies/index.ts.
 */

import type { Actor, ActorId, FloorState } from "../types";
import type { Rng } from "../../rng";

/** Combat behaviours: what the monster does when it has enemies to fight. */
export type CombatStrategyTag = "melee" | "frightened";

/** Idle behaviours: what the monster does when it has nothing to fight. */
export type IdleStrategyTag = "stationary" | "roam" | "follow";

/** Per-monster runtime state persisted alongside Actor. */
export interface MonsterAIState {
	combatStrategy: CombatStrategyTag;
	idleStrategy: IdleStrategyTag;
	/** Last tile index where an enemy was seen. Cleared on arrival. undefined = never seen / forgotten. */
	lastKnownEnemyIdx?: number;
	/** Target actor ID for the "follow" idle strategy. */
	followTargetId?: ActorId;
}

/** Input context passed to every AI strategy function. */
export interface AIContext {
	monster: Actor;
	aiState: MonsterAIState;
	/** The hero actor — used by strategies that need to flee from or reference the player directly. */
	hero: Actor;
	heroId: ActorId;
	/** LoS mask computed from the monster's tile. 1 = visible from monster, 0 = not visible. */
	visibleFromMonster: Uint8Array;
	walkableMask: Uint8Array;
	floorState: FloorState;
	width: number;
	height: number;
	rng: Rng;
	/**
	 * Effective factions for all alive actors this turn.
	 * Computed by the engine at the start of processEnemyTurns; incorporates CHARMED flips.
	 * Keyed by actorId → "player" | "hostile".
	 */
	effectiveFactions: Record<string, "player" | "hostile">;
	/**
	 * If set, overrides aiState.combatStrategy for this turn only — the original strategy is
	 * restored to the persisted state after the turn so status effects do not corrupt saved data.
	 */
	combatStrategyOverride?: CombatStrategyTag;
}

export type AIResult =
	| { kind: "attack"; targetActorId?: string }
	| { kind: "move"; toIdx: number }
	/**
	 * The monster has nothing to do this turn.
	 * When returned by a combat strategy the dispatcher runs the idle strategy instead.
	 * When returned by an idle strategy (or the dispatcher after idle) it is final.
	 */
	| { kind: "idle" }
	/** Monster chooses to use a skill. The engine resolves it via resolveSkill. */
	| { kind: "skill"; skillId: string; targetTileIdx?: number; targetActorId?: string };

export interface AITurnResult {
	result: AIResult;
	newAIState: MonsterAIState;
}
