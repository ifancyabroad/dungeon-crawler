/**
 * Monster AI — public types, strategy registry, and dispatcher.
 *
 * Adding a new strategy:
 * 1. Add a new literal to AIStrategyTag.
 * 2. Create packages/shared/src/game/strategies/<name>.ts implementing (ctx: AIContext) => AITurnResult.
 * 3. Import the function below and register it in AI_STRATEGIES.
 */

import type { Actor, ActorId, FloorState } from "./types";
import type { Rng } from "../rng";
import { runMeleeAI } from "./strategies/melee";
import { runFrightenedAI } from "./strategies/frightened";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** All valid AI strategy identifiers. Extend this union to add new strategies. */
export type AIStrategyTag = "melee" | "frightened";

/** Per-monster runtime state persisted alongside Actor. */
export interface MonsterAIState {
	strategy: AIStrategyTag;
	/** Last tile index where the primary enemy was seen. Cleared on arrival. undefined = never seen / forgotten. */
	lastKnownHeroIdx?: number;
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
	 * If set, overrides aiState.strategy for this turn only — the original strategy is
	 * restored to the persisted state after the turn so status effects do not corrupt saved data.
	 */
	strategyOverride?: AIStrategyTag;
}

export type AIResult =
	| { kind: "attack"; targetActorId?: string }
	| { kind: "move"; toIdx: number }
	| { kind: "idle" }
	/** Monster chooses to use a skill. The engine resolves it via resolveSkill. */
	| { kind: "skill"; skillId: string; targetTileIdx?: number; targetActorId?: string };

export interface AITurnResult {
	result: AIResult;
	newAIState: MonsterAIState;
}

// ---------------------------------------------------------------------------
// Strategy registry and dispatcher
// ---------------------------------------------------------------------------

const AI_STRATEGIES: Record<AIStrategyTag, (ctx: AIContext) => AITurnResult> = {
	melee: runMeleeAI,
	frightened: runFrightenedAI,
};

/** Run the correct AI strategy for a monster. Dispatches by strategyOverride ?? aiState.strategy. */
export function runMonsterAI(ctx: AIContext): AITurnResult {
	const tag = ctx.strategyOverride ?? ctx.aiState.strategy;
	const fn = AI_STRATEGIES[tag];
	return fn(ctx);
}
