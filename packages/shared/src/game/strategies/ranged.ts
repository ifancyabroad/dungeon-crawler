/**
 * Ranged combat strategy.
 *
 * Used by NPCs that prefer distance over melee (e.g. goblin mage).
 *
 * Decision tree:
 * 1. No enemies visible and no last-known position → idle.
 * 2. Adjacent enemy → attempt to flee one step away; fall back to melee attack if stuck.
 * 3. Visible enemy → delegate skill selection to evaluateNpcSkill. If a skill fires, use it.
 * 4. Visible enemy but no skill ready → reposition toward ideal stand-off distance.
 * 5. Last-known enemy position → BFS toward it; clear on arrival or if path blocked.
 * 6. Idle (hand off to idle strategy).
 *
 * All skill selection (ranged damage, self-buffs, AoE, approach) is handled by
 * evaluateNpcSkill so this strategy focuses purely on stand-off positioning.
 */

import type { AIContext, AITurnResult, NpcAIState } from "./types";
import { getAdjacentIndices } from "../engine";
import { bfsNextStep } from "../../map/pathfinding";
import { GAME_CONFIG } from "../../config";
import { evaluateNpcSkill, findFleeStep } from "./skillEvaluator";

/** Preferred stand-off distance in tiles (Chebyshev). */
const IDEAL_RANGE = GAME_CONFIG.ai.ranged.idealRange;

export function runRangedAI(ctx: AIContext): AITurnResult {
	const {
		npc,
		aiState,
		effectiveFactions,
		visibleFromNpc,
		walkableMask,
		floorState,
		width,
		height,
		getSkillDef,
	} = ctx;
	const newAIState: NpcAIState = { ...aiState };

	const myFaction = effectiveFactions[npc.id] ?? "hostile";
	const enemyFaction: "player" | "hostile" = myFaction === "hostile" ? "player" : "hostile";

	const enemies = Object.values(floorState.actorsById).filter(
		(a) => a.alive && a.id !== npc.id && effectiveFactions[a.id] === enemyFaction,
	);

	if (enemies.length === 0) {
		return { result: { kind: "idle" }, newAIState };
	}

	const chebyshev = (aIdx: number, bIdx: number) =>
		Math.max(
			Math.abs((aIdx % width) - (bIdx % width)),
			Math.abs(Math.floor(aIdx / width) - Math.floor(bIdx / width)),
		);

	const adjacent = getAdjacentIndices(npc.idx, width, height);

	// Step 2: Adjacent enemy — try to flee one step, otherwise fall back to attack.
	const adjacentEnemy = enemies.find((a) => adjacent.includes(a.idx));
	if (adjacentEnemy) {
		const fleeStep = findFleeStep(
			npc.idx,
			adjacentEnemy.idx,
			walkableMask,
			floorState,
			width,
			height,
		);
		if (fleeStep !== undefined) {
			return { result: { kind: "move", toIdx: fleeStep }, newAIState };
		}
		// Cornered — can't flee, attack instead.
		return { result: { kind: "attack", targetActorId: adjacentEnemy.id }, newAIState };
	}

	// Steps 3 & 4: Visible enemies.
	const visibleEnemies = enemies.filter((a) => visibleFromNpc[a.idx] === 1);

	if (visibleEnemies.length > 0) {
		const nearest = visibleEnemies.reduce((best, a) =>
			chebyshev(npc.idx, a.idx) < chebyshev(npc.idx, best.idx) ? a : best,
		);
		newAIState.lastKnownEnemyIdx = nearest.idx;

		const dist = chebyshev(npc.idx, nearest.idx);

		// Delegate all skill decisions to the shared evaluator.
		if (getSkillDef) {
			const skillResult = evaluateNpcSkill(
				npc,
				getSkillDef,
				nearest,
				dist,
				floorState,
				walkableMask,
				width,
				height,
			);
			if (skillResult) return { result: skillResult, newAIState };
		}

		// No skill fired — reposition toward ideal stand-off distance.
		if (dist > IDEAL_RANGE) {
			const step = bfsNextStep(npc.idx, nearest.idx, walkableMask, floorState, width, height);
			if (step !== undefined) {
				return { result: { kind: "move", toIdx: step }, newAIState };
			}
		}
		// At ideal range or can't move closer — hold position and wait for cooldown.
		return { result: { kind: "idle" }, newAIState };
	}

	// Step 5: Last-known enemy position.
	if (newAIState.lastKnownEnemyIdx !== undefined) {
		const target = newAIState.lastKnownEnemyIdx;
		if (npc.idx === target) {
			newAIState.lastKnownEnemyIdx = undefined;
		} else {
			const step = bfsNextStep(npc.idx, target, walkableMask, floorState, width, height);
			if (step !== undefined) {
				return { result: { kind: "move", toIdx: step }, newAIState };
			}
			newAIState.lastKnownEnemyIdx = undefined;
		}
	}

	return { result: { kind: "idle" }, newAIState };
}
