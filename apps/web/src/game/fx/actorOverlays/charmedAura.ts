/**
 * Charmed overlay: a pulsing hot-pink glow ring around the actor.
 */

import { hasActiveEffect, STATUS_HOOKS, type Actor } from "@app/shared";
import type { ActorOverlayEffect } from "../ActorEffectVisualManager";

export const charmedAura: ActorOverlayEffect = {
	id: "charmed_aura",
	isActive: (actor: Actor) => hasActiveEffect(actor, STATUS_HOOKS.CHARMED),
	build: (scene) => {
		const gfx = scene.add.graphics();
		gfx.setDepth(21);

		gfx.lineStyle(3, 0xff66aa, 0.85);
		gfx.strokeCircle(0, 0, 22);
		gfx.fillStyle(0xff66aa, 0.1);
		gfx.fillCircle(0, 0, 22);

		const tween = scene.tweens.add({
			targets: gfx,
			scaleX: { from: 1, to: 1.15 },
			scaleY: { from: 1, to: 1.15 },
			alpha: { from: 0.85, to: 0.2 },
			duration: 700,
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
