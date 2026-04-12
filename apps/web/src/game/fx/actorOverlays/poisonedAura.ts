/**
 * Poisoned overlay: a sickly green pulsing ring around the actor.
 */

import { hasActiveEffect, STATUS_HOOKS, type Actor } from "@app/shared";
import type { ActorOverlayEffect } from "../ActorEffectVisualManager";

export const poisonedAura: ActorOverlayEffect = {
	id: "poisoned_aura",
	isActive: (actor: Actor) => hasActiveEffect(actor, STATUS_HOOKS.POISONED),
	build: (scene) => {
		const gfx = scene.add.graphics();
		gfx.setDepth(21);

		gfx.lineStyle(3, 0x88dd44, 0.85);
		gfx.strokeCircle(0, 0, 22);
		gfx.fillStyle(0x88dd44, 0.1);
		gfx.fillCircle(0, 0, 22);

		const tween = scene.tweens.add({
			targets: gfx,
			scaleX: { from: 1, to: 1.15 },
			scaleY: { from: 1, to: 1.15 },
			alpha: { from: 0.85, to: 0.25 },
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
