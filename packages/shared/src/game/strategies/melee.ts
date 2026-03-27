/**
 * Faction-aware melee combat strategy.
 *
 * Uses effectiveFactions to determine who counts as an "enemy" this turn —
 * normally the hero, but a CHARMED NPC's enemies are the other hostile
 * actors, and a future player-faction summon targets hostiles automatically
 * with zero extra code.
 *
 * Decision tree:
 * 1. An enemy actor is adjacent → attack it.
 * 2. An enemy actor is in LoS → record lastKnownEnemyIdx, BFS one step toward the nearest one.
 * 3. lastKnownEnemyIdx is set → BFS toward it; clear on arrival or if path blocked.
 * 4. Otherwise → { kind: "idle" } to hand off to the idle strategy.
 */

import type { AIContext, AITurnResult, NpcAIState } from "./types";
import { getAdjacentIndices8 } from "../engine";
import { bfsNextStep } from "../../map/pathfinding";

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

	// 1. Adjacent enemy → use an off-cooldown skill if available, otherwise attack
	const adjacentEnemy = enemies.find((a) => adjacent.includes(a.idx));
	if (adjacentEnemy) {
		const availableSkillId = Object.entries(npc.skills ?? {}).find(
			([, state]) => state.cooldownRemaining === 0,
		)?.[0];
		if (availableSkillId) {
			return {
				result: {
					kind: "skill",
					skillId: availableSkillId,
					targetActorId: adjacentEnemy.id,
				},
				newAIState,
			};
		}
		return { result: { kind: "attack", targetActorId: adjacentEnemy.id }, newAIState };
	}

	// 2. Enemy in LoS → update last-known position, BFS toward nearest visible enemy
	const visibleEnemies = enemies.filter((a) => visibleFromNpc[a.idx] === 1);
	if (visibleEnemies.length > 0) {
		const nearest = visibleEnemies.reduce((best, a) =>
			chebyshev(npc.idx, a.idx) < chebyshev(npc.idx, best.idx) ? a : best,
		);
		newAIState.lastKnownEnemyIdx = nearest.idx;
		const step = bfsNextStep(npc.idx, nearest.idx, walkableMask, floorState, width, height);
		if (step !== undefined) {
			return { result: { kind: "move", toIdx: step }, newAIState };
		}
	}

	// 3. Last known enemy position → BFS toward it; clear on arrival or path blocked
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

	// 4. Nothing to do — defer to idle strategy
	return { result: { kind: "idle" }, newAIState };
}
