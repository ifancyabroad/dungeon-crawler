/**
 * Revealed overlay: a bright yellow-white pulsing double ring — a spotlight
 * effect indicating the actor's stealth has been stripped.
 */

import { hasActiveEffect, STATUS_HOOKS, type Actor } from "@app/shared";
import type { ActorOverlayEffect } from "../ActorEffectVisualManager";

export const revealedAura: ActorOverlayEffect = {
	id: "revealed_aura",
	isActive: (actor: Actor) => hasActiveEffect(actor, STATUS_HOOKS.REVEALED),
	build: (scene) => {
		const gfx = scene.add.graphics();
		gfx.setDepth(21);

		gfx.lineStyle(3, 0xffff88, 0.9);
		gfx.strokeCircle(0, 0, 24);
		gfx.lineStyle(2, 0xffffcc, 0.6);
		gfx.strokeCircle(0, 0, 16);
		gfx.fillStyle(0xffff88, 0.07);
		gfx.fillCircle(0, 0, 24);

		const tween = scene.tweens.add({
			targets: gfx,
			scaleX: { from: 1, to: 1.2 },
			scaleY: { from: 1, to: 1.2 },
			alpha: { from: 0.9, to: 0.3 },
			duration: 400,
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
