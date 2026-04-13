import type { AttackAction } from "./schemas";
import type { Actor, FloorState, GameEvent, GameState, LootDrop } from "../types";
import type { ApplyActionContext, ApplyActionResult } from "../engineContext";
import { createRngFromState } from "../../rng";
import { resolveAttack } from "../../combat/resolveAttack";
import { applyDamageToActor } from "../../combat/applyDamageToActor";
import { tickActiveEffects, hasActiveEffect } from "../../skills";
import { STATUS_HOOKS } from "../../config/skills";
import {
	getHero,
	getActorAtIdx,
	DIRECTION_DELTA,
	isSqueezeBlocked,
	idxToXY,
	computeTargetCell,
	breakStealth,
	tickSkillCooldowns,
	computeAttackMod,
	computeWeaponProficiencyBonus,
} from "../engineUtils";
import { processEnemyTurns } from "../engineEnemyTurns";
import { applyKillRewards } from "../engineLevelUp";

export function applyAttack(
	action: AttackAction,
	state: GameState,
	context: ApplyActionContext,
): ApplyActionResult {
	const hero = getHero(state);
	if (!hero || !hero.alive) return { ok: false, reason: "attack_no_hero" };
	if (hasActiveEffect(hero, STATUS_HOOKS.STUNNED)) {
		return { ok: false, reason: "hero_stunned" };
	}
	const fi = state.heroFloorIndex;
	const floor = state.floors[fi];
	if (!floor) return { ok: false, reason: "attack_no_floor" };
	const width = floor.config.width;
	const height = floor.config.height;

	const target = computeTargetCell(hero.idx, action.direction, width, height);
	if (!target) return { ok: false, reason: "attack_out_of_bounds" };
	const { dx: adx, dy: ady } = DIRECTION_DELTA[action.direction];
	if (adx !== 0 && ady !== 0) {
		const attackMask = context.getWalkableMask(fi);
		const { x: hx, y: hy } = idxToXY(hero.idx, width);
		if (isSqueezeBlocked(hx, hy, adx, ady, width, height, attackMask)) {
			return { ok: false, reason: "attack_out_of_bounds" };
		}
	}

	const defender = getActorAtIdx(floor.state, target.newIdx);
	if (!defender) return { ok: false, reason: "attack_no_target" };

	// CHARMED: hero cannot attack the actor that charmed them.
	const charmedEffect = hero.activeEffects.find(
		(e) => e.id === STATUS_HOOKS.CHARMED && e.remainingTurns > 0,
	);
	if (charmedEffect && defender.id === charmedEffect.sourceActorId) {
		return { ok: false, reason: "hero_charmed" };
	}

	const { rng, getState: getRngState } = createRngFromState(state.rngState);
	const events: GameEvent[] = [];

	// Attacking breaks stealth — hero is revealed before enemy turns.
	const { hero: activeHero, floorState: activeFloorState } = breakStealth(
		hero,
		state.heroId,
		floor.state,
	);

	// Hero attacks enemy
	const attackResult = resolveAttack(
		activeHero,
		defender,
		rng,
		activeHero.equippedWeaponDice,
		computeAttackMod(activeHero),
		computeWeaponProficiencyBonus(activeHero),
	);
	events.push({
		type: "attack",
		attackerId: state.heroId,
		defenderId: defender.id,
		result: attackResult,
	});

	let updatedHero: Actor = activeHero;
	let updatedDefender: Actor | undefined;
	let attackPendingInteraction = null;
	let attackLootOverrides: Record<string, number> | undefined;
	let attackLootByIdx: Record<string, LootDrop> | undefined;

	if (attackResult.hit) {
		const { updatedActor, events: damageEvents } = applyDamageToActor(
			defender,
			attackResult.damage,
		);
		updatedDefender = updatedActor;
		events.push(...damageEvents);

		if (!updatedDefender.alive) {
			events.push({ type: "death", actorId: defender.id });
			const rewards = applyKillRewards(
				activeHero,
				state.heroId,
				[updatedDefender],
				fi,
				rng,
				context.getClassSkillPools,
				context.itemsById,
				context.affixesById,
			);
			updatedHero = rewards.hero;
			events.push(...rewards.events);
			if (rewards.pendingInteraction) attackPendingInteraction = rewards.pendingInteraction;
			if (Object.keys(rewards.lootOverrides).length > 0) {
				attackLootOverrides = rewards.lootOverrides;
				attackLootByIdx = rewards.lootByIdx;
			}
		}
	}

	const newActorsById = {
		...activeFloorState.actorsById,
		[state.heroId]: updatedHero,
		...(updatedDefender ? { [defender.id]: updatedDefender } : {}),
	};

	let newFloorState: FloorState = {
		...activeFloorState,
		actorsById: newActorsById,
		...(attackLootOverrides && {
			tileOverrides: { ...activeFloorState.tileOverrides, ...attackLootOverrides },
		}),
		...(attackLootByIdx && {
			lootByIdx: { ...activeFloorState.lootByIdx, ...attackLootByIdx },
		}),
	};

	// Enemy turns after attack (skip if we're about to pause for a skill choice)
	if (!attackPendingInteraction) {
		const attackWalkMask = context.getWalkableMask(fi);
		const attackOpacityMask = context.getOpacityMask(fi);
		const enemyResult = processEnemyTurns(
			newFloorState,
			state.heroId,
			width,
			height,
			attackWalkMask,
			attackOpacityMask,
			rng,
			context.getSkillDef,
		);
		newFloorState = enemyResult.floorState;
		events.push(...enemyResult.events);
	}

	const newFloors = state.floors.slice();
	newFloors[fi] = { ...floor, state: newFloorState };

	let newState: GameState = {
		...state,
		turn: state.turn + 1,
		floors: newFloors,
		rngState: getRngState(),
		pendingInteraction: attackPendingInteraction,
	};

	// Only tick status/cooldowns when game is not pausing
	if (!attackPendingInteraction) {
		const { state: tickedAttackState, events: tickAttackEvents } = tickActiveEffects(newState);
		events.push(...tickAttackEvents);
		newState = tickSkillCooldowns(tickedAttackState);
	}

	return { ok: true, state: newState, events };
}
