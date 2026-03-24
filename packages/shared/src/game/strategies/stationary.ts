/**
 * Stationary idle strategy.
 *
 * The NPC does not move when it has nothing to fight.
 * This is the default idle strategy — anything that should wander or
 * follow must opt in with an explicit idleStrategy in content.
 */

import type { AIContext, AIResult } from "./types";

export function runStationaryAI(_ctx: AIContext): AIResult {
	return { kind: "idle" };
}
