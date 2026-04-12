/**
 * Regenerating overlay: a soft mint-green glow ring around the actor.
 */

import { hasActiveEffect, STATUS_HOOKS, type Actor } from "@app/shared";
import type { ActorOverlayEffect } from "../ActorEffectVisualManager";

export const regeneratingAura: ActorOverlayEffect = {
	id: "regenerating_aura",
	isActive: (actor: Actor) => hasActiveEffect(actor, STATUS_HOOKS.REGENERATING),
	build: (scene) => {
		const gfx = scene.add.graphics();
		gfx.setDepth(21);

		gfx.lineStyle(3, 0x44ff88, 0.8);
		gfx.strokeCircle(0, 0, 22);
		gfx.fillStyle(0x44ff88, 0.12);
		gfx.fillCircle(0, 0, 22);

		const tween = scene.tweens.add({
			targets: gfx,
			scaleX: { from: 1, to: 1.1 },
			scaleY: { from: 1, to: 1.1 },
			alpha: { from: 0.8, to: 0.2 },
			duration: 800,
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
