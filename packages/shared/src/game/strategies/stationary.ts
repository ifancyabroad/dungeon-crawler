/**
 * Stationary idle strategy.
 *
 * The monster does not move when it has nothing to fight.
 * This is the default idle strategy for all monsters — anything that should
 * wander or follow must opt in with an explicit idleStrategy in content.
 */

import type { AIContext, AIResult } from "../monsterAI";

export function runStationaryAI(_ctx: AIContext): AIResult {
	return { kind: "idle" };
}
