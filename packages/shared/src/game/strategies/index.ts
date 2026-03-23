/**
 * Monster AI — strategy registry and dispatcher.
 *
 * Adding a new combat strategy:
 * 1. Add a new literal to CombatStrategyTag in ./types.
 * 2. Create packages/shared/src/game/strategies/<name>.ts implementing
 *    (ctx: AIContext) => AITurnResult.  Return { kind: "roam" } when the
 *    monster has nothing to fight. Return { kind: "idle" } to hand off to the idle layer.
 * 3. Import and register it in COMBAT_STRATEGIES below.
 *
 * Adding a new idle strategy:
 * 1. Add a new literal to IdleStrategyTag in ./types.
 * 2. Create packages/shared/src/game/strategies/<name>.ts implementing
 *    (ctx: AIContext) => AIResult.
 * 3. Import and register it in IDLE_STRATEGIES below.
 */

import type {
	CombatStrategyTag,
	IdleStrategyTag,
	AIContext,
	AITurnResult,
	AIResult,
} from "./types";
import { runMeleeAI } from "./melee";
import { runFrightenedAI } from "./frightened";
import { runStationaryAI } from "./stationary";
import { runRoamAI } from "./roam";
import { runFollowAI } from "./follow";

type CombatStrategyFn = (ctx: AIContext) => AITurnResult;
type IdleStrategyFn = (ctx: AIContext) => AIResult;

const COMBAT_STRATEGIES: Record<CombatStrategyTag, CombatStrategyFn> = {
	melee: runMeleeAI,
	frightened: runFrightenedAI,
};

const IDLE_STRATEGIES: Record<IdleStrategyTag, IdleStrategyFn> = {
	stationary: runStationaryAI,
	roam: runRoamAI,
	follow: runFollowAI,
};

/**
 * Run the monster's AI for one turn.
 * Phase 1 — combat: dispatch by combatStrategyOverride ?? aiState.combatStrategy.
 * Phase 2 — idle:   if combat returns { kind: "idle" }, dispatch by aiState.idleStrategy.
 */
export function runMonsterAI(ctx: AIContext): AITurnResult {
	const combatTag = ctx.combatStrategyOverride ?? ctx.aiState.combatStrategy;
	const { result, newAIState } = COMBAT_STRATEGIES[combatTag](ctx);
	if (result.kind !== "idle") return { result, newAIState };
	return { result: IDLE_STRATEGIES[ctx.aiState.idleStrategy](ctx), newAIState };
}

export type {
	CombatStrategyTag,
	IdleStrategyTag,
	MonsterAIState,
	AIContext,
	AIResult,
	AITurnResult,
} from "./types";
