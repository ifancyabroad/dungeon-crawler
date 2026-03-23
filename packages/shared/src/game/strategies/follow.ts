/**
 * Follow idle strategy.
 *
 * The monster BFS-paths toward aiState.followTargetId each turn, staying one
 * step away — it never occupies the target's tile.
 *
 * Returns idle if:
 *   - followTargetId is unset or the target actor is not found / not alive.
 *   - The monster is already on an adjacent tile and BFS would land on the target.
 *   - No valid path exists.
 */

import type { AIContext, AIResult } from "./types";
import { bfsNextStep } from "../../map/pathfinding";

export function runFollowAI(ctx: AIContext): AIResult {
	const { monster, aiState, floorState, walkableMask, width, height } = ctx;

	const targetId = aiState.followTargetId;
	if (!targetId) return { kind: "idle" };

	const target = floorState.actorsById[targetId];
	if (!target?.alive) return { kind: "idle" };

	if (monster.idx === target.idx) return { kind: "idle" };

	const step = bfsNextStep(monster.idx, target.idx, walkableMask, floorState, width, height);
	if (step === undefined || step === target.idx) return { kind: "idle" };

	return { kind: "move", toIdx: step };
}
