/**
 * Aggregates all persistent actor buff visuals.
 *
 * To add a new overlay effect:
 *   1. Create a file in this directory that exports an `ActorOverlayEffect`.
 *   2. Import it here and add it to ALL_ACTOR_OVERLAY_EFFECTS.
 *
 * To add a new tint effect:
 *   1. Add an entry to ACTOR_STATUS_TINTS in actorStatusTints.ts.
 */

export { resolveActorTint } from "./actorStatusTints";
export type { StatusTintEntry } from "./actorStatusTints";
export { shieldOrbEffect } from "./shieldOrb";

import type { ActorOverlayEffect } from "../ActorEffectVisualManager";
import { shieldOrbEffect } from "./shieldOrb";

export const ALL_ACTOR_OVERLAY_EFFECTS: ActorOverlayEffect[] = [
	shieldOrbEffect,
	// Add new overlay effects here as they are created.
];
