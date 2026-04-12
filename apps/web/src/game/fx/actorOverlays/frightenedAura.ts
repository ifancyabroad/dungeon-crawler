/**
 * Frightened overlay: a purple ring that repeatedly expands outward and fades,
 * suggesting panic radiating from the actor.
 */

import { hasActiveEffect, STATUS_HOOKS, type Actor } from "@app/shared";
import type { ActorOverlayEffect } from "../ActorEffectVisualManager";

export const frightenedAura: ActorOverlayEffect = {
	id: "frightened_aura",
	isActive: (actor: Actor) => hasActiveEffect(actor, STATUS_HOOKS.FRIGHTENED),
	build: (scene) => {
		const gfx = scene.add.graphics();
		gfx.setDepth(21);

		gfx.lineStyle(2, 0xbb44ee, 0.8);
		gfx.strokeCircle(0, 0, 24);

		const tween = scene.tweens.add({
			targets: gfx,
			scaleX: { from: 0.5, to: 1.5 },
			scaleY: { from: 0.5, to: 1.5 },
			alpha: { from: 0.7, to: 0 },
			duration: 600,
			repeat: -1,
			ease: "Sine.Out",
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
