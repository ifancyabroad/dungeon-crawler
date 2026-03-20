/**
 * Manages persistent visual overlays (orbs, auras, etc.) on an actor sprite
 * driven by active buffs or numeric buff state.
 *
 * Usage:
 *   1. Create an instance, passing the Phaser scene.
 *   2. Register each visual effect with `register()`.
 *   3. Call `sync(actor, x, y)` every turn to add/remove visuals based on the
 *      current actor state.
 *   4. Call `destroy()` on scene shutdown.
 *
 * Adding a new persistent visual requires only a new `ActorOverlayEffect`
 * in fx/buffVisuals/ — no changes to this class or MainScene are needed.
 */

import type { Actor } from "@app/shared";
import Phaser from "phaser";

/** A live visual instance returned by `ActorOverlayEffect.build`. */
export interface ActorOverlayHandle {
	/** Called every frame to keep the overlay positioned over the actor sprite. */
	reposition(x: number, y: number): void;
	/** Tear down Phaser objects and stop tweens. */
	destroy(): void;
}

/** Descriptor for a single persistent actor overlay effect. */
export interface ActorOverlayEffect {
	/** Unique identifier — must be stable across frames. */
	id: string;
	/** Return true while the visual should be shown for the given actor. */
	isActive(actor: Actor): boolean;
	/** Called once to construct the Phaser objects. Must return a handle. */
	build(scene: Phaser.Scene): ActorOverlayHandle;
}

export class ActorEffectVisualManager {
	private readonly effects: ActorOverlayEffect[] = [];
	private readonly active = new Map<string, ActorOverlayHandle>();
	private readonly scene: Phaser.Scene;
	private readonly onUpdate: () => void;
	private px = 0;
	private py = 0;

	constructor(scene: Phaser.Scene) {
		this.scene = scene;
		this.onUpdate = () => {
			for (const handle of this.active.values()) {
				handle.reposition(this.px, this.py);
			}
		};
		scene.events.on("update", this.onUpdate);
	}

	register(effect: ActorOverlayEffect): void {
		this.effects.push(effect);
	}

	/**
	 * Synchronise overlay visuals with the current actor state.
	 * @param actor - Current actor.
	 * @param px    - World X in pixels (sprite centre).
	 * @param py    - World Y in pixels (sprite centre).
	 */
	sync(actor: Actor, px: number, py: number): void {
		this.px = px;
		this.py = py;

		for (const effect of this.effects) {
			const shouldBeActive = effect.isActive(actor);
			const isCurrentlyActive = this.active.has(effect.id);

			if (shouldBeActive && !isCurrentlyActive) {
				const handle = effect.build(this.scene);
				handle.reposition(px, py);
				this.active.set(effect.id, handle);
			} else if (!shouldBeActive && isCurrentlyActive) {
				this.active.get(effect.id)!.destroy();
				this.active.delete(effect.id);
			}
		}
	}

	destroy(): void {
		this.scene.events.off("update", this.onUpdate);
		for (const handle of this.active.values()) {
			handle.destroy();
		}
		this.active.clear();
	}
}
