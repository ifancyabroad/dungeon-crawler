/**
 * Silenced overlay: a muted grey ring around the actor indicating suppressed magic.
 */

import { hasActiveEffect, STATUS_HOOKS, type Actor } from "@app/shared";
import type { ActorOverlayEffect } from "../ActorEffectVisualManager";

export const silencedAura: ActorOverlayEffect = {
	id: "silenced_aura",
	isActive: (actor: Actor) => hasActiveEffect(actor, STATUS_HOOKS.SILENCED),
	build: (scene) => {
		const gfx = scene.add.graphics();
		gfx.setDepth(21);

		gfx.lineStyle(2, 0x999999, 0.8);
		gfx.strokeCircle(0, 0, 20);
		gfx.fillStyle(0x999999, 0.06);
		gfx.fillCircle(0, 0, 20);

		const tween = scene.tweens.add({
			targets: gfx,
			alpha: { from: 0.8, to: 0.2 },
			duration: 600,
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
