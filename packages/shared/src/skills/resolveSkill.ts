/**
 * Skill resolver: validates prerequisites and dispatches each effect descriptor
 * to the appropriate handler. Returns the updated floor state, caster, and events.
 *
 * Called from the engine's "use_skill" branch (hero) and future monster skill branches.
 * The "caster" may be the hero or any monster — the resolver is actor-agnostic.
 */

import type { GameEvent } from "../game/types";
import type {
	SkillResolutionInput,
	SkillResolutionOutput,
	ActiveSkillEffectDescriptor,
} from "./types";
import { applyAreaDamage } from "./effects/areaDamage";
import { applyStatusEffect } from "./effects/applyStatus";
import { applyShieldEffect } from "./effects/applyShield";
import { applyChargeAttack } from "./effects/chargeAttack";
import { applyLeapAttack } from "./effects/applyLeapAttack";
import { applyLineDamage } from "./effects/lineDamage";
import { applyConeDamage } from "./effects/coneDamage";
import { applySingleTargetDamage } from "./effects/singleTargetDamage";
import { applySneakAttack } from "./effects/applySneakAttack";
import { applyShadowStep } from "./effects/applyShadowStep";

export function resolveSkill(
	input: SkillResolutionInput,
): SkillResolutionOutput | { error: string } {
	const {
		skillDef,
		caster,
		casterId,
		floorState: initialFloorState,
		width,
		height,
		rng,
		targetTileIdx,
		targetActorId,
		opacityMask,
	} = input;

	// Validate targeting
	if (skillDef.targetType === "tile" && targetTileIdx === undefined) {
		return { error: "skill_missing_tile_target" };
	}
	if (skillDef.targetType === "actor" && !targetActorId) {
		return { error: "skill_missing_actor_target" };
	}

	let floorState = initialFloorState;
	let currentCaster = caster;
	const events: GameEvent[] = [
		{
			type: "skill_used",
			actorId: casterId,
			skillId: skillDef.id,
			targetTileIdx,
			targetActorId,
		},
	];

	for (const effect of skillDef.effects as ActiveSkillEffectDescriptor[]) {
		switch (effect.type) {
			case "area_damage": {
				// "none" target type: emanate from caster's own tile (e.g. War Cry)
				const areaTarget = targetTileIdx !== undefined ? targetTileIdx : currentCaster.idx;
				const result = applyAreaDamage(
					effect,
					currentCaster,
					areaTarget,
					floorState,
					width,
					rng,
					skillDef.id,
				);
				floorState = result.floorState;
				events.push(...result.events);
				break;
			}

			case "apply_status": {
				if (effect.target === "target" && targetActorId) {
					// Apply to the targeted actor (e.g. poison_blade poisons the enemy).
					const targetActor = floorState.actorsById[targetActorId];
					if (targetActor && targetActor.alive) {
						const result = applyStatusEffect(effect, targetActor);
						floorState = {
							...floorState,
							actorsById: {
								...floorState.actorsById,
								[targetActorId]: result.caster,
							},
						};
						events.push(...result.events);
					}
				} else {
					// Default: apply to caster.
					const result = applyStatusEffect(effect, currentCaster);
					currentCaster = result.caster;
					events.push(...result.events);
				}
				break;
			}

			case "apply_shield": {
				const result = applyShieldEffect(effect, currentCaster);
				currentCaster = result.caster;
				events.push(...result.events);
				break;
			}

			case "charge_attack": {
				if (!targetActorId) return { error: "skill_missing_actor_target" };
				const result = applyChargeAttack(
					effect,
					currentCaster,
					targetActorId,
					floorState,
					width,
					height,
					rng,
					skillDef.id,
				);
				if ("error" in result) return result;
				floorState = result.floorState;
				currentCaster = result.caster;
				events.push(...result.events);
				break;
			}

			case "line_damage": {
				if (targetTileIdx === undefined) return { error: "skill_missing_tile_target" };
				const result = applyLineDamage(
					effect,
					currentCaster,
					targetTileIdx,
					floorState,
					width,
					height,
					rng,
					skillDef.id,
					opacityMask,
				);
				floorState = result.floorState;
				events.push(...result.events);
				break;
			}

			case "cone_damage": {
				if (targetTileIdx === undefined) return { error: "skill_missing_tile_target" };
				const result = applyConeDamage(
					effect,
					currentCaster,
					targetTileIdx,
					floorState,
					width,
					height,
					rng,
					skillDef.id,
				);
				floorState = result.floorState;
				events.push(...result.events);
				break;
			}

			case "single_target_damage": {
				if (!targetActorId) return { error: "skill_missing_actor_target" };
				const result = applySingleTargetDamage(
					effect,
					currentCaster,
					targetActorId,
					floorState,
					rng,
					skillDef.id,
				);
				if ("error" in result) return result;
				floorState = result.floorState;
				events.push(...result.events);
				break;
			}

			case "leap_attack": {
				if (targetTileIdx === undefined) return { error: "skill_missing_tile_target" };
				const result = applyLeapAttack(
					effect,
					currentCaster,
					targetTileIdx,
					floorState,
					width,
					height,
					rng,
					skillDef.id,
					opacityMask,
				);
				if ("error" in result) return result;
				floorState = result.floorState;
				currentCaster = result.caster;
				events.push(...result.events);
				break;
			}

			case "sneak_attack": {
				if (!targetActorId) return { error: "skill_missing_actor_target" };
				const result = applySneakAttack(
					effect,
					currentCaster,
					targetActorId,
					floorState,
					width,
					rng,
					skillDef.id,
				);
				if ("error" in result) return result;
				floorState = result.floorState;
				currentCaster = result.caster;
				events.push(...result.events);
				break;
			}

			case "shadow_step": {
				if (targetTileIdx === undefined) return { error: "skill_missing_tile_target" };
				const result = applyShadowStep(
					effect,
					currentCaster,
					targetTileIdx,
					floorState,
					opacityMask,
				);
				if ("error" in result) return result;
				floorState = result.floorState;
				currentCaster = result.caster;
				events.push(...result.events);
				break;
			}

			default: {
				const _exhaustive: never = effect;
				void _exhaustive;
			}
		}
	}

	// Sync caster back into floorState (activeEffects, position etc. may have changed)
	const finalFloorState = {
		...floorState,
		actorsById: {
			...floorState.actorsById,
			[casterId]: currentCaster,
		},
	};

	return { floorState: finalFloorState, caster: currentCaster, events };
}
