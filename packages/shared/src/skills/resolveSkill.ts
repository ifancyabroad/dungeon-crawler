/**
 * Skill resolver: validates prerequisites and dispatches each effect descriptor
 * to the appropriate handler. Returns the updated floor state, caster, and events.
 *
 * Called from the engine's "use_skill" branch (hero) and future monster skill branches.
 * The "caster" may be the hero or any monster — the resolver is actor-agnostic.
 */

import type { GameEvent } from "../game/types";
import type { SkillResolutionInput, SkillResolutionOutput } from "./types";
import { applyAreaDamage } from "./effects/areaDamage";
import { applyStatusEffect } from "./effects/applyStatus";
import { applyChargeAttack } from "./effects/chargeAttack";

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

	for (const effect of skillDef.effects) {
		switch (effect.type) {
			case "area_damage": {
				if (targetTileIdx === undefined) return { error: "skill_missing_tile_target" };
				const result = applyAreaDamage(
					effect,
					currentCaster,
					targetTileIdx,
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
				const result = applyStatusEffect(effect, currentCaster);
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

			default: {
				const _exhaustive: never = effect;
				void _exhaustive;
			}
		}
	}

	// Sync caster back into floorState (statusEffects, position etc. may have changed)
	const finalFloorState = {
		...floorState,
		actorsById: {
			...floorState.actorsById,
			[casterId]: currentCaster,
		},
	};

	return { floorState: finalFloorState, caster: currentCaster, events };
}
