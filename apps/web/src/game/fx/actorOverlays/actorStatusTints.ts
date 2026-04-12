/**
 * Registry of sprite tints applied to actor sprites while specific active
 * effects are present.
 *
 * To add a tint for a new status/buff, add an entry to ACTOR_STATUS_TINTS.
 * The first matching entry wins when multiple tints could apply simultaneously.
 */

import { hasActiveEffect, STATUS_HOOKS, type Actor } from "@app/shared";

export interface StatusTintEntry {
	/** The active effect id to check for. */
	effectId: string;
	/** Phaser tint colour (0xRRGGBB). */
	tint: number;
}

export const ACTOR_STATUS_TINTS: StatusTintEntry[] = [
	{ effectId: "berserk", tint: 0xff5500 },
	{ effectId: STATUS_HOOKS.POISONED, tint: 0x88dd44 },
	{ effectId: STATUS_HOOKS.BURNING, tint: 0xff5500 },
	{ effectId: STATUS_HOOKS.BLEEDING, tint: 0xcc1122 },
	{ effectId: STATUS_HOOKS.REGENERATING, tint: 0x44ff88 },
	{ effectId: STATUS_HOOKS.STUNNED, tint: 0xaaaaaa },
	{ effectId: STATUS_HOOKS.CHARMED, tint: 0xff66aa },
	{ effectId: STATUS_HOOKS.FRIGHTENED, tint: 0xdddd33 },
	{ effectId: STATUS_HOOKS.SILENCED, tint: 0x888888 },
	{ effectId: STATUS_HOOKS.ROOTED, tint: 0xaa7733 },
	{ effectId: STATUS_HOOKS.REVEALED, tint: 0xffffa0 },
	{ effectId: STATUS_HOOKS.STEALTH, tint: 0x7777bb },
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

/**
 * Returns the sprite alpha that should be applied to the actor's sprite.
 * Actors under STEALTH are rendered semi-transparent.
 */
export function resolveActorAlpha(actor: Actor): number {
	return hasActiveEffect(actor, STATUS_HOOKS.STEALTH) ? 0.4 : 1.0;
}
