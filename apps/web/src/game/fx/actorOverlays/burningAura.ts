/**
 * Burning overlay: a rapidly flickering orange ring around the actor.
 */

import { hasActiveEffect, STATUS_HOOKS, type Actor } from "@app/shared";
import type { ActorOverlayEffect } from "../ActorEffectVisualManager";

export const burningAura: ActorOverlayEffect = {
	id: "burning_aura",
	isActive: (actor: Actor) => hasActiveEffect(actor, STATUS_HOOKS.BURNING),
	build: (scene) => {
		const gfx = scene.add.graphics();
		gfx.setDepth(21);

		gfx.lineStyle(3, 0xff6600, 0.9);
		gfx.strokeCircle(0, 0, 20);
		gfx.fillStyle(0xff8800, 0.1);
		gfx.fillCircle(0, 0, 20);

		const tween = scene.tweens.add({
			targets: gfx,
			scaleX: { from: 1, to: 1.2 },
			scaleY: { from: 1, to: 1.2 },
			alpha: { from: 0.9, to: 0.2 },
			duration: 150,
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
