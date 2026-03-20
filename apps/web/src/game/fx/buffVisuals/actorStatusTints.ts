/**
 * Registry of sprite tints applied to actor sprites while specific active
 * effects are present.
 *
 * To add a tint for a new status/buff, add an entry to ACTOR_STATUS_TINTS.
 * The first matching entry wins when multiple tints could apply simultaneously.
 */

import { hasActiveEffect, type Actor } from "@app/shared";

export interface StatusTintEntry {
	/** The active effect id to check for. */
	effectId: string;
	/** Phaser tint colour (0xRRGGBB). */
	tint: number;
}

export const ACTOR_STATUS_TINTS: StatusTintEntry[] = [
	{ effectId: "berserk", tint: 0xff5500 },
	// Future entries:
	// { effectId: "frozen", tint: 0x88ccff },
	// { effectId: "burning", tint: 0xff2200 },
];

/**
 * Returns the sprite tint that should be applied to the actor's sprite,
 * or 0xffffff (no tint) when no matching effect is active.
 */
export function resolveActorTint(actor: Actor): number {
	for (const { effectId, tint } of ACTOR_STATUS_TINTS) {
		if (hasActiveEffect(actor, effectId)) return tint;
	}
	return 0xffffff;
}
