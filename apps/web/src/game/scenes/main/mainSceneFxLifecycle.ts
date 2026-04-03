import type Phaser from "phaser";
import { MoveTweenManager } from "../../fx/MoveTweenManager";
import { AttackAnimator } from "../../fx/AttackAnimator";
import { HealthBarManager } from "../../fx/HealthBarManager";
import { DeathFxManager } from "../../fx/DeathFxManager";
import { DamageNumberManager } from "../../fx/DamageNumberManager";
import { GoldFxManager } from "../../fx/GoldFxManager";
import { SkillAnimationController } from "../../skills/SkillAnimationController";
import { ActorEffectVisualManager } from "../../fx/ActorEffectVisualManager";
import { ALL_ACTOR_OVERLAY_EFFECTS } from "../../fx/buffVisuals";

export interface FloorFxRefs {
	moveTweens: MoveTweenManager | null;
	attackAnimator: AttackAnimator | null;
	healthBars: HealthBarManager | null;
	deathFx: DeathFxManager | null;
	damageNumbers: DamageNumberManager | null;
	goldFx: GoldFxManager | null;
	skillAnimController: SkillAnimationController | null;
	actorEffectVisuals: ActorEffectVisualManager | null;
}

export function createFloorFx(scene: Phaser.Scene, mapWidth: number): FloorFxRefs {
	const moveTweens = new MoveTweenManager(scene);
	const attackAnimator = new AttackAnimator(scene, mapWidth);
	const healthBars = new HealthBarManager(scene);
	const deathFx = new DeathFxManager(scene, mapWidth);
	const damageNumbers = new DamageNumberManager(scene, mapWidth);
	const goldFx = new GoldFxManager(scene, mapWidth);
	const skillAnimController = new SkillAnimationController(scene, mapWidth);
	const actorEffectVisuals = new ActorEffectVisualManager(scene);
	for (const effect of ALL_ACTOR_OVERLAY_EFFECTS) {
		actorEffectVisuals.register(effect);
	}
	return {
		moveTweens,
		attackAnimator,
		healthBars,
		deathFx,
		damageNumbers,
		goldFx,
		skillAnimController,
		actorEffectVisuals,
	};
}

export function destroyFloorFx(refs: FloorFxRefs): FloorFxRefs {
	refs.moveTweens?.destroy();
	refs.attackAnimator?.destroy();
	refs.healthBars?.destroy();
	refs.actorEffectVisuals?.destroy();
	return {
		moveTweens: null,
		attackAnimator: null,
		healthBars: null,
		deathFx: null,
		damageNumbers: null,
		goldFx: null,
		skillAnimController: null,
		actorEffectVisuals: null,
	};
}
