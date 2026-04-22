/**
 * Skirmisher combat strategy.
 *
 * For agile, mobile NPCs (flying predators, pouncing creatures) that prefer to
 * engage with gap-closing skills rather than fighting from a static position.
 *
 * The retreat decision is stateless: when adjacent to an enemy AND a gap-closing
 * skill (leap/charge/shadow_step) is off cooldown, the NPC retreats one step to
 * create distance for a re-engagement next turn. When no approach skill is ready,
 * it fights in melee like a normal melee NPC.
 *
 * This creates a natural rhythm driven by cooldowns:
 *   - Approach skill ready + adjacent  → retreat one step
 *   - Next turn at distance 2+, skill still ready → use it (deals damage on close)
 *   - Approach skill on cooldown + adjacent → attack / use combat skills normally
 *   - Repeat when cooldown expires
 *
 * Decision tree:
 * 1. No enemies visible → idle.
 * 2. Adjacent enemy + approach skill ready + flee step available → retreat.
 * 3. Adjacent enemy (no skill or cornered) → evaluate combat skills / basic attack.
 * 4. Visible enemy, not adjacent → evaluate all skills (approach, buff, combat).
 *    If no skill fires → BFS one step toward nearest.
 * 5. Last-known enemy position → BFS toward it; clear on arrival or if path blocked.
 * 6. Idle.
 */

import type { AIContext, AITurnResult, NpcAIState } from "./types";
import type { SkillDefinition } from "../../skills";
import type { Actor } from "../types";
import { getAdjacentIndices8 } from "../engineUtils";
import { bfsNextStep } from "../../map/pathfinding";
import { evaluateNpcSkill, findFleeStep } from "./skillEvaluator";

export function runSkirmisherAI(ctx: AIContext): AITurnResult {
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

	// 1. No enemies — defer to idle strategy.
	if (enemies.length === 0) {
		return { result: { kind: "idle" }, newAIState };
	}

	const chebyshev = (aIdx: number, bIdx: number) =>
		Math.max(
			Math.abs((aIdx % width) - (bIdx % width)),
			Math.abs(Math.floor(aIdx / width) - Math.floor(bIdx / width)),
		);

	const visibleEnemies = enemies.filter((a) => visibleFromNpc[a.idx] === 1);
	const nearest =
		visibleEnemies.length > 0
			? visibleEnemies.reduce((best, a) =>
					chebyshev(npc.idx, a.idx) < chebyshev(npc.idx, best.idx) ? a : best,
				)
			: undefined;

	const adjacent8 = getAdjacentIndices8(npc.idx, width, height);
	const adjacentEnemy = enemies.find((a) => adjacent8.includes(a.idx));

	if (adjacentEnemy) {
		newAIState.lastKnownEnemyIdx = adjacentEnemy.idx;

		// 2. Adjacent + approach skill ready → retreat to set up re-engagement.
		if (getSkillDef && hasApproachSkillReady(npc, getSkillDef)) {
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
		}

		// 3. No approach skill or cornered → evaluate combat skills / basic attack.
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

	// 4. Not adjacent — evaluate all skills, then BFS toward nearest visible enemy.
	if (nearest) {
		newAIState.lastKnownEnemyIdx = nearest.idx;
		const dist = chebyshev(npc.idx, nearest.idx);

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

		const step = bfsNextStep(npc.idx, nearest.idx, walkableMask, floorState, width, height);
		if (step !== undefined) {
			return { result: { kind: "move", toIdx: step }, newAIState };
		}
	}

	// 5. Last-known enemy position → BFS toward it; clear on arrival or path blocked.
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

	// 6. Idle.
	return { result: { kind: "idle" }, newAIState };
}

/**
 * Returns true if the NPC has at least one gap-closing skill (leap/shadow_step/charge)
 * that is currently off cooldown. Used to decide whether to retreat when adjacent.
 */
function hasApproachSkillReady(
	npc: Actor,
	getSkillDef: (id: string) => SkillDefinition | undefined,
): boolean {
	for (const [skillId, state] of Object.entries(npc.skills ?? {})) {
		if (state.cooldownRemaining !== 0) continue;
		const def = getSkillDef(skillId);
		if (!def || def.skillType !== "active") continue;
		const effects = def.effectsByRank[Math.min(Math.max(state.rank - 1, 0), 2) as 0 | 1 | 2];
		if (
			effects.some(
				(e) =>
					e.type === "leap_attack" ||
					e.type === "shadow_step" ||
					e.type === "charge_attack",
			)
		) {
			return true;
		}
	}
	return false;
}
