import type { UseSkillAction } from "./schemas";
import type { Actor, FloorState, GameState } from "../types";
import type { ApplyActionContext, ApplyActionResult } from "../engineContext";
import type { ActiveSkillDefinition } from "../../skills";
import { createRngFromState } from "../../rng";
import { resolveSkill, hasActiveEffect, tickActiveEffects } from "../../skills";
import { STATUS_HOOKS } from "../../config/skills";
import { getHero, breakStealth, tickSkillCooldowns } from "../engineUtils";
import { processEnemyTurns } from "../engineEnemyTurns";
import { applyKillRewards } from "../engineLevelUp";

export function applyUseSkill(
	action: UseSkillAction,
	state: GameState,
	context: ApplyActionContext,
): ApplyActionResult {
	const hero = getHero(state);
	if (!hero || !hero.alive) return { ok: false, reason: "skill_no_hero" };
	if (hasActiveEffect(hero, STATUS_HOOKS.STUNNED)) {
		return { ok: false, reason: "hero_stunned" };
	}
	if (hasActiveEffect(hero, STATUS_HOOKS.SILENCED)) {
		return { ok: false, reason: "hero_silenced" };
	}
	const fi = state.heroFloorIndex;
	const floor = state.floors[fi];
	if (!floor) return { ok: false, reason: "skill_no_floor" };

	const skillDef = context.getSkillDef(action.skillId);
	if (!skillDef) return { ok: false, reason: "skill_unknown" };

	// Passive skills cannot be used via the hotbar
	if (skillDef.skillType === "passive") return { ok: false, reason: "skill_is_passive" };

	// Validate that the hero has this skill (it was awarded at creation)
	const skillState = hero.skills[action.skillId];
	if (!skillState) return { ok: false, reason: "skill_not_owned" };
	if (skillState.cooldownRemaining > 0) return { ok: false, reason: "skill_on_cooldown" };
	if (!hero.armorProficient) return { ok: false, reason: "skill_armor_not_proficient" };

	const width = floor.config.width;
	const height = floor.config.height;
	const { rng, getState: getRngState } = createRngFromState(state.rngState);

	// Using a skill that doesn't explicitly maintain stealth reveals the hero.
	const { hero: heroForSkill, floorState: floorForSkill } = !(skillDef as ActiveSkillDefinition)
		.maintainsStealth
		? breakStealth(hero, state.heroId, floor.state)
		: { hero, floorState: floor.state };

	const resolution = resolveSkill({
		skillDef: skillDef as ActiveSkillDefinition,
		rank: skillState.rank,
		caster: heroForSkill,
		casterId: state.heroId,
		floorState: floorForSkill,
		width,
		height,
		rng,
		targetTileIdx: action.targetTileIdx,
		targetActorId: action.targetActorId,
		opacityMask: context.getOpacityMask(fi),
	});

	if ("error" in resolution) return { ok: false, reason: resolution.error };

	// Set cooldown on the caster (hero)
	const heroAfterSkill: Actor = {
		...resolution.caster,
		skills: {
			...resolution.caster.skills,
			[action.skillId]: { ...skillState, cooldownRemaining: skillDef.cooldown },
		},
	};

	let newFloorState: FloorState = {
		...resolution.floorState,
		actorsById: {
			...resolution.floorState.actorsById,
			[state.heroId]: heroAfterSkill,
		},
	};

	// Collect killed NPCs from the resolution events, then apply XP and loot rewards in one pass.
	const killedActors = resolution.events
		.filter((e) => e.type === "death")
		.map((e) => newFloorState.actorsById[e.actorId])
		.filter((a): a is Actor => a !== undefined && a.def.type === "npc");

	const rewards = applyKillRewards(
		heroAfterSkill,
		state.heroId,
		killedActors,
		fi,
		rng,
		context.getClassSkillPools,
		context.itemsById,
		context.affixesById,
	);

	const skillPendingInteraction = rewards.pendingInteraction;
	const skillXpEvents = rewards.events;

	// Re-sync updated hero (XP/level may have changed) and merge loot state
	newFloorState = {
		...newFloorState,
		actorsById: { ...newFloorState.actorsById, [state.heroId]: rewards.hero },
		...(Object.keys(rewards.lootOverrides).length > 0 && {
			tileOverrides: { ...newFloorState.tileOverrides, ...rewards.lootOverrides },
		}),
		...(Object.keys(rewards.lootByIdx).length > 0 && {
			lootByIdx: { ...newFloorState.lootByIdx, ...rewards.lootByIdx },
		}),
	};

	// Enemy turns (skip if we're about to pause for a skill choice)
	if (!skillPendingInteraction) {
		const skillWalkMask = context.getWalkableMask(fi);
		const skillOpacityMask = context.getOpacityMask(fi);
		const enemyResult = processEnemyTurns(
			newFloorState,
			state.heroId,
			width,
			height,
			skillWalkMask,
			skillOpacityMask,
			rng,
			context.getSkillDef,
		);
		newFloorState = enemyResult.floorState;
		skillXpEvents.push(...enemyResult.events);
	}

	const newFloors = state.floors.slice();
	newFloors[fi] = { ...floor, state: newFloorState };

	let newState: GameState = {
		...state,
		turn: state.turn + 1,
		floors: newFloors,
		rngState: getRngState(),
		pendingInteraction: skillPendingInteraction,
	};

	// Only tick status/cooldowns when game is not pausing
	if (!skillPendingInteraction) {
		const { state: tickedSkillState, events: tickSkillEvents } = tickActiveEffects(newState);
		skillXpEvents.push(...tickSkillEvents);
		newState = tickSkillCooldowns(tickedSkillState);
	}

	return {
		ok: true,
		state: newState,
		events: [...resolution.events, ...skillXpEvents],
	};
}
