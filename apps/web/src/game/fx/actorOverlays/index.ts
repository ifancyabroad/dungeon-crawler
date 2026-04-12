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

export { resolveActorTint, resolveActorAlpha } from "./actorStatusTints";
export type { StatusTintEntry } from "./actorStatusTints";
export { shieldOrbEffect } from "./shieldOrb";

import type { ActorOverlayEffect } from "../ActorEffectVisualManager";
import { shieldOrbEffect } from "./shieldOrb";
import { poisonedAura } from "./poisonedAura";
import { burningAura } from "./burningAura";
import { bleedingAura } from "./bleedingAura";
import { regeneratingAura } from "./regeneratingAura";
import { stunnedStars } from "./stunnedStars";
import { charmedAura } from "./charmedAura";
import { frightenedAura } from "./frightenedAura";
import { silencedAura } from "./silencedAura";
import { rootedAura } from "./rootedAura";
import { revealedAura } from "./revealedAura";
import { stealthAura } from "./stealthAura";

export const ALL_ACTOR_OVERLAY_EFFECTS: ActorOverlayEffect[] = [
	shieldOrbEffect,
	poisonedAura,
	burningAura,
	bleedingAura,
	regeneratingAura,
	stunnedStars,
	charmedAura,
	frightenedAura,
	silencedAura,
	rootedAura,
	revealedAura,
	stealthAura,
];
