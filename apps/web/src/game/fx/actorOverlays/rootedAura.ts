/**
 * Rooted overlay: an earthy brown ring at the base of the actor, suggesting
 * roots binding them to the ground.
 */

import { hasActiveEffect, STATUS_HOOKS, type Actor } from "@app/shared";
import type { ActorOverlayEffect } from "../ActorEffectVisualManager";

const FOOT_Y_OFFSET = 8;

export const rootedAura: ActorOverlayEffect = {
	id: "rooted_aura",
	isActive: (actor: Actor) => hasActiveEffect(actor, STATUS_HOOKS.ROOTED),
	build: (scene) => {
		const gfx = scene.add.graphics();
		gfx.setDepth(21);

		gfx.lineStyle(3, 0x886633, 0.9);
		gfx.strokeEllipse(0, 0, 44, 18);
		gfx.lineStyle(2, 0x55aa33, 0.5);
		gfx.strokeEllipse(0, 0, 34, 12);

		const tween = scene.tweens.add({
			targets: gfx,
			alpha: { from: 0.9, to: 0.3 },
			duration: 500,
			yoyo: true,
			repeat: -1,
			ease: "Sine.InOut",
		});

		return {
			reposition: (x, y) => gfx.setPosition(x, y + FOOT_Y_OFFSET),
			destroy: () => {
				tween.stop();
				gfx.destroy();
			},
		};
	},
};
