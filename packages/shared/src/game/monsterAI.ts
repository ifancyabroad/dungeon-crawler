/**
 * Monster AI strategies.
 *
 * Adding a new strategy:
 * 1. Add a new literal to AIStrategyTag.
 * 2. Implement a function with signature (ctx: AIContext) => AITurnResult.
 * 3. Register it in AI_STRATEGIES.
 */

import type { Actor, ActorId, FloorState } from "./types";
import type { Rng } from "../rng";
import { getActorAtIdx, getAdjacentIndices } from "./engine";
import { bfsNextStep } from "../map/pathfinding";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** All valid AI strategy identifiers. Extend this union to add new strategies. */
export type AIStrategyTag = "melee";

/** Per-monster runtime state persisted alongside Actor. */
export interface MonsterAIState {
	strategy: AIStrategyTag;
	/** Last tile index where the hero was seen. Cleared on arrival. undefined = never seen / forgotten. */
	lastKnownHeroIdx?: number;
}

/** Input context passed to every AI strategy function. */
export interface AIContext {
	monster: Actor;
	aiState: MonsterAIState;
	hero: Actor;
	heroId: ActorId;
	/** LoS mask computed from the monster's tile. 1 = visible from monster, 0 = not visible. */
	visibleFromMonster: Uint8Array;
	walkableMask: Uint8Array;
	floorState: FloorState;
	width: number;
	height: number;
	rng: Rng;
}

export type AIResult = { kind: "attack" } | { kind: "move"; toIdx: number } | { kind: "idle" };

export interface AITurnResult {
	result: AIResult;
	newAIState: MonsterAIState;
}

// ---------------------------------------------------------------------------
// Melee AI
// ---------------------------------------------------------------------------

/**
 * Decision tree:
 * 1. Hero is adjacent → attack.
 * 2. Hero is in LoS → update lastKnownHeroIdx, BFS one step toward hero.
 * 3. lastKnownHeroIdx is set → BFS toward it; clear on arrival.
 * 4. Otherwise → random adjacent walkable step (roam), or idle if none free.
 */
export function runMeleeAI(ctx: AIContext): AITurnResult {
	const {
		monster,
		aiState,
		hero,
		visibleFromMonster,
		walkableMask,
		floorState,
		width,
		height,
		rng,
	} = ctx;
	const newAIState: MonsterAIState = { ...aiState };

	// 1. Adjacent to hero → attack
	const adjacent = getAdjacentIndices(monster.idx, width, height);
	if (adjacent.includes(hero.idx)) {
		return { result: { kind: "attack" }, newAIState };
	}

	// 2. Hero in LoS → chase
	if (visibleFromMonster[hero.idx] === 1) {
		newAIState.lastKnownHeroIdx = hero.idx;
		const step = bfsNextStep(monster.idx, hero.idx, walkableMask, floorState, width, height);
		if (step !== undefined) {
			return { result: { kind: "move", toIdx: step }, newAIState };
		}
	}

	// 3. Last known position → move toward it
	if (newAIState.lastKnownHeroIdx !== undefined) {
		const target = newAIState.lastKnownHeroIdx;
		if (monster.idx === target) {
			// Arrived; hero is gone — stop chasing
			newAIState.lastKnownHeroIdx = undefined;
		} else {
			const step = bfsNextStep(monster.idx, target, walkableMask, floorState, width, height);
			if (step !== undefined) {
				return { result: { kind: "move", toIdx: step }, newAIState };
			}
			// Path blocked — give up
			newAIState.lastKnownHeroIdx = undefined;
		}
	}

	// 4. Roam: pick a random walkable adjacent tile not occupied by another actor
	const roamCandidates = adjacent.filter(
		(idx) => walkableMask[idx] === 1 && !getActorAtIdx(floorState, idx),
	);
	if (roamCandidates.length > 0) {
		const pick = roamCandidates[Math.floor(rng() * roamCandidates.length)];
		return { result: { kind: "move", toIdx: pick }, newAIState };
	}

	return { result: { kind: "idle" }, newAIState };
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

const AI_STRATEGIES: Record<AIStrategyTag, (ctx: AIContext) => AITurnResult> = {
	melee: runMeleeAI,
};

/** Run the correct AI strategy for a monster. Dispatches by aiState.strategy. */
export function runMonsterAI(ctx: AIContext): AITurnResult {
	const fn = AI_STRATEGIES[ctx.aiState.strategy];
	return fn(ctx);
}
