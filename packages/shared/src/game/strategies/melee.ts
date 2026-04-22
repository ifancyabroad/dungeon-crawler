/**
 * Faction-aware melee combat strategy.
 *
 * Uses effectiveFactions to determine who counts as an "enemy" this turn —
 * normally the hero, but a CHARMED NPC's enemies are the other hostile
 * actors, and a future player-faction summon targets hostiles automatically
 * with zero extra code.
 *
 * Decision tree:
 * 1. An enemy actor is adjacent → delegate skill selection to evaluateNpcSkill;
 *    fall back to basic attack if no skill fires.
 * 2. An enemy actor is in LoS → evaluateNpcSkill for approach/combat skills,
 *    then BFS one step toward the nearest visible enemy if nothing fires.
 * 3. lastKnownEnemyIdx is set → BFS toward it; clear on arrival or if path blocked.
 * 4. Otherwise → { kind: "idle" } to hand off to the idle strategy.
 *
 * All skill selection logic (targeting, HP thresholds, approach skills, AoE) is
 * handled by evaluateNpcSkill so this strategy focuses purely on positioning.
 */

import type { AIContext, AITurnResult, NpcAIState } from "./types";
import { getAdjacentIndices8 } from "../engineUtils";
import { bfsNextStep } from "../../map/pathfinding";
import { evaluateNpcSkill } from "./skillEvaluator";

export function runMeleeAI(ctx: AIContext): AITurnResult {
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

	const adjacent = getAdjacentIndices8(npc.idx, width, height);

	// 1. Adjacent enemy → evaluate skills then fall back to basic attack.
	const adjacentEnemy = enemies.find((a) => adjacent.includes(a.idx));
	if (adjacentEnemy) {
		if (getSkillDef) {
			const skillResult = evaluateNpcSkill(
				npc,
				getSkillDef,
				adjacentEnemy,
				1,
				floorState,
				walkableMask,
				width,
				height,
			);
			if (skillResult) return { result: skillResult, newAIState };
		}
		return { result: { kind: "attack", targetActorId: adjacentEnemy.id }, newAIState };
	}

	// 2. Enemy in LoS → evaluate approach/combat skills, then BFS toward nearest.
	const visibleEnemies = enemies.filter((a) => visibleFromNpc[a.idx] === 1);
	if (visibleEnemies.length > 0) {
		const nearest = visibleEnemies.reduce((best, a) =>
			chebyshev(npc.idx, a.idx) < chebyshev(npc.idx, best.idx) ? a : best,
		);
		newAIState.lastKnownEnemyIdx = nearest.idx;

		if (getSkillDef) {
			const dist = chebyshev(npc.idx, nearest.idx);
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

		const step = bfsNextStep(npc.idx, nearest.idx, walkableMask, floorState, width, height);
		if (step !== undefined) {
			return { result: { kind: "move", toIdx: step }, newAIState };
		}
	}

	// 3. Last known enemy position → BFS toward it; clear on arrival or path blocked.
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

	// 4. Nothing to do — defer to idle strategy.
	return { result: { kind: "idle" }, newAIState };
}
