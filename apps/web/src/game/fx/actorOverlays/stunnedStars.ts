/**
 * Stunned overlay: three small yellow circles orbiting above the actor.
 */

import { hasActiveEffect, STATUS_HOOKS, type Actor } from "@app/shared";
import type { ActorOverlayEffect } from "../ActorEffectVisualManager";

const ORB_COUNT = 3;
const ORBIT_RADIUS = 20;
const ORBIT_Y_OFFSET = -8;
const ORBIT_INTERVAL_MS = 50;
const ORBIT_STEP = 0.18; // radians per interval

export const stunnedStars: ActorOverlayEffect = {
	id: "stunned_stars",
	isActive: (actor: Actor) => hasActiveEffect(actor, STATUS_HOOKS.STUNNED),
	build: (scene) => {
		let cx = 0;
		let cy = 0;
		let angle = 0;

		const orbs = [] as ReturnType<typeof scene.add.graphics>[];
		for (let i = 0; i < ORB_COUNT; i++) {
			const orb = scene.add.graphics();
			orb.fillStyle(0xffee00, 1);
			orb.fillCircle(0, 0, 3);
			orb.setDepth(21);
			orbs.push(orb);
		}

		const timer = scene.time.addEvent({
			delay: ORBIT_INTERVAL_MS,
			repeat: -1,
			callback: () => {
				angle += ORBIT_STEP;
				for (let i = 0; i < ORB_COUNT; i++) {
					const a = angle + (i * 2 * Math.PI) / ORB_COUNT;
					orbs[i].setPosition(
						cx + Math.cos(a) * ORBIT_RADIUS,
						cy + ORBIT_Y_OFFSET + Math.sin(a) * (ORBIT_RADIUS * 0.4),
					);
				}
			},
		});

		return {
			reposition: (x, y) => {
				cx = x;
				cy = y;
			},
			destroy: () => {
				timer.remove();
				for (const orb of orbs) orb.destroy();
			},
		};
	},
};
