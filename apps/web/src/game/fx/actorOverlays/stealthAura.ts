/**
 * Stealth overlay: a dark blue-purple shimmer ring while the actor is hidden.
 * The hero sprite alpha (0.4) is managed separately by actorSpriteSync.
 */

import { hasActiveEffect, STATUS_HOOKS, type Actor } from "@app/shared";
import type { ActorOverlayEffect } from "../ActorEffectVisualManager";

export const stealthAura: ActorOverlayEffect = {
	id: "stealth_aura",
	isActive: (actor: Actor) => hasActiveEffect(actor, STATUS_HOOKS.STEALTH),
	build: (scene) => {
		const gfx = scene.add.graphics();
		gfx.setDepth(21);

		gfx.lineStyle(2, 0x6655cc, 0.7);
		gfx.strokeCircle(0, 0, 22);
		gfx.fillStyle(0x4444aa, 0.08);
		gfx.fillCircle(0, 0, 22);

		const tween = scene.tweens.add({
			targets: gfx,
			scaleX: { from: 1, to: 1.05 },
			scaleY: { from: 1, to: 1.05 },
			alpha: { from: 0.7, to: 0.1 },
			duration: 1000,
			yoyo: true,
			repeat: -1,
			ease: "Sine.InOut",
		});

		return {
			reposition: (x, y) => gfx.setPosition(x, y),
			destroy: () => {
				tween.stop();
				gfx.destroy();
			},
		};
	},
};
