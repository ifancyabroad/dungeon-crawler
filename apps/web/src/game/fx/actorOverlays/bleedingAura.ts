/**
 * Bleeding overlay: a dark red pulsing ring around the actor.
 */

import { hasActiveEffect, STATUS_HOOKS, type Actor } from "@app/shared";
import type { ActorOverlayEffect } from "../ActorEffectVisualManager";

export const bleedingAura: ActorOverlayEffect = {
	id: "bleeding_aura",
	isActive: (actor: Actor) => hasActiveEffect(actor, STATUS_HOOKS.BLEEDING),
	build: (scene) => {
		const gfx = scene.add.graphics();
		gfx.setDepth(21);

		gfx.lineStyle(3, 0xcc1122, 0.9);
		gfx.strokeCircle(0, 0, 18);
		gfx.fillStyle(0xcc1122, 0.08);
		gfx.fillCircle(0, 0, 18);

		const tween = scene.tweens.add({
			targets: gfx,
			alpha: { from: 0.9, to: 0.2 },
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
