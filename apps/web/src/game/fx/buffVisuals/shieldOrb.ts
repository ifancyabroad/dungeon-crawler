/**
 * Persistent shield overlay: a shimmering orb drawn around an actor while
 * their shield HP (numericBuffs.shieldHp) is greater than zero.
 */

import type { Actor } from "@app/shared";
import type { ActorOverlayEffect } from "../ActorEffectVisualManager";

export const shieldOrbEffect: ActorOverlayEffect = {
	id: "shield_orb",
	isActive: (actor: Actor) => (actor.numericBuffs?.["shieldHp"] ?? 0) > 0,
	build: (scene) => {
		const gfx = scene.add.graphics();
		gfx.setDepth(22);

		gfx.lineStyle(4, 0x66bbff, 0.35);
		gfx.strokeCircle(0, 0, 24);
		gfx.lineStyle(2, 0xaaeeff, 0.85);
		gfx.strokeCircle(0, 0, 18);
		gfx.fillStyle(0x44aaff, 0.07);
		gfx.fillCircle(0, 0, 24);

		const tween = scene.tweens.add({
			targets: gfx,
			alpha: { from: 1, to: 0.45 },
			scaleX: { from: 1, to: 1.1 },
			scaleY: { from: 1, to: 1.1 },
			duration: 900,
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
