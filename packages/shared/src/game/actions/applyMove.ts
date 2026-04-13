import type { MoveAction } from "./schemas";
import type { Actor, FloorState, GameEvent, GameState, PendingInteraction } from "../types";
import type { ApplyActionContext, ApplyActionResult } from "../engineContext";
import { createRngFromState } from "../../rng";
import { computeVisibility, mergeExplored } from "../../map/visibility";
import { tickActiveEffects, hasActiveEffect } from "../../skills";
import { STATUS_HOOKS } from "../../config/skills";
import {
	getHero,
	getActorAtIdx,
	DIRECTION_DELTA,
	isSqueezeBlocked,
	idxToXY,
	computeTargetCell,
	tickSkillCooldowns,
} from "../engineUtils";
import { processEnemyTurns } from "../engineEnemyTurns";
import { VISION_RADIUS } from "../../config/game";

export function applyMove(
	action: MoveAction,
	state: GameState,
	context: ApplyActionContext,
): ApplyActionResult {
	const hero = getHero(state);
	if (!hero || !hero.alive) return { ok: false, reason: "move_no_hero" };
	if (hasActiveEffect(hero, STATUS_HOOKS.STUNNED)) {
		return { ok: false, reason: "hero_stunned" };
	}
	if (hasActiveEffect(hero, STATUS_HOOKS.ROOTED)) {
		return { ok: false, reason: "hero_rooted" };
	}
	const fi = state.heroFloorIndex;
	const floor = state.floors[fi];
	if (!floor) return { ok: false, reason: "move_no_floor" };
	const width = floor.config.width;
	const height = floor.config.height;
	const size = width * height;
	const mask = context.getWalkableMask(fi);

	const target = computeTargetCell(hero.idx, action.direction, width, height);
	if (!target) return { ok: false, reason: "move_out_of_bounds" };
	const { nx, ny, newIdx } = target;

	// FRIGHTENED: hero cannot willingly move closer to the source of fear.
	// Uses Chebyshev distance (max of |dx|, |dy|) to match 8-directional movement.
	// Restriction lifts automatically when the fear source dies.
	const frightenedEffect = hero.activeEffects.find(
		(e) => e.id === STATUS_HOOKS.FRIGHTENED && e.remainingTurns > 0,
	);
	if (frightenedEffect) {
		const fearSource = floor.state.actorsById[frightenedEffect.sourceActorId];
		if (fearSource?.alive) {
			const { x: hx, y: hy } = idxToXY(hero.idx, width);
			const { x: fx, y: fy } = idxToXY(fearSource.idx, width);
			const currentDist = Math.max(Math.abs(hx - fx), Math.abs(hy - fy));
			const newDist = Math.max(Math.abs(nx - fx), Math.abs(ny - fy));
			if (newDist < currentDist) {
				return { ok: false, reason: "hero_frightened" };
			}
		}
	}

	if (newIdx < 0 || newIdx >= size || mask[newIdx] !== 1) {
		return { ok: false, reason: "move_blocked" };
	}
	const { dx, dy } = DIRECTION_DELTA[action.direction];
	if (dx !== 0 && dy !== 0) {
		const { x: hx, y: hy } = idxToXY(hero.idx, width);
		if (isSqueezeBlocked(hx, hy, dx, dy, width, height, mask)) {
			return { ok: false, reason: "move_blocked" };
		}
	}
	if (getActorAtIdx(floor.state, newIdx)) {
		return { ok: false, reason: "move_blocked_by_enemy" };
	}

	const updatedHero: Actor = { ...hero, idx: newIdx };
	const newActorsById = { ...floor.state.actorsById, [state.heroId]: updatedHero };

	const opacityMask = context.getOpacityMask(fi);
	const visible = computeVisibility(nx, ny, width, height, opacityMask, VISION_RADIUS);
	const explored = mergeExplored(floor.state.explored, visible, size);

	let newFloorState: FloorState = { ...floor.state, actorsById: newActorsById, explored };

	// Loot tile detection: hero stepped onto a tile that has a loot pile.
	const moveLoot = newFloorState.lootByIdx[String(newIdx)];
	let movePendingInteraction: PendingInteraction = null;
	const moveEvents: GameEvent[] = [];
	if (moveLoot) {
		if (moveLoot.items.length === 0 && moveLoot.gold) {
			// Gold-only pile: auto-collect.
			const goldAmount = moveLoot.gold;
			const heroWithGold: Actor = {
				...updatedHero,
				gold: updatedHero.gold + goldAmount,
			};
			const clearedLootByIdx = { ...newFloorState.lootByIdx };
			delete clearedLootByIdx[String(newIdx)];
			const clearedOverrides = { ...newFloorState.tileOverrides };
			delete clearedOverrides[String(newIdx)];
			newFloorState = {
				...newFloorState,
				actorsById: { ...newFloorState.actorsById, [state.heroId]: heroWithGold },
				lootByIdx: clearedLootByIdx,
				tileOverrides: clearedOverrides,
			};
			moveEvents.push({
				type: "gold_collected",
				actorId: state.heroId,
				amount: goldAmount,
				tileIdx: newIdx,
			});
		} else {
			// Items present: pause for loot pickup modal.
			// Auto-collect any gold in the pile immediately (same as gold-only case).
			let collectedGold: number | undefined;
			let lootForModal = moveLoot;
			if (moveLoot.gold) {
				const goldAmount = moveLoot.gold;
				collectedGold = goldAmount;
				const heroWithGold: Actor = {
					...updatedHero,
					gold: updatedHero.gold + goldAmount,
				};
				lootForModal = { ...moveLoot, gold: undefined };
				const updatedLootByIdx = {
					...newFloorState.lootByIdx,
					[String(newIdx)]: lootForModal,
				};
				newFloorState = {
					...newFloorState,
					actorsById: { ...newFloorState.actorsById, [state.heroId]: heroWithGold },
					lootByIdx: updatedLootByIdx,
				};
				moveEvents.push({
					type: "gold_collected",
					actorId: state.heroId,
					amount: goldAmount,
					tileIdx: newIdx,
				});
			}
			movePendingInteraction = {
				type: "loot_pickup",
				tileIdx: newIdx,
				loot: lootForModal,
				collectedGold,
			};
		}
	}

	// Skip enemy turns and paused processing if hero stepped on a loot pile.
	if (movePendingInteraction) {
		const pausedFloors = state.floors.slice();
		pausedFloors[fi] = { ...floor, state: newFloorState };
		const pausedState: GameState = {
			...state,
			turn: state.turn + 1,
			floors: pausedFloors,
			pendingInteraction: movePendingInteraction,
		};
		return { ok: true, state: pausedState, events: moveEvents };
	}

	// Enemy turns on current floor (before potential descend)
	const { rng, getState: getRngState } = createRngFromState(state.rngState);
	const enemyResult = processEnemyTurns(
		newFloorState,
		state.heroId,
		width,
		height,
		mask,
		opacityMask,
		rng,
		context.getSkillDef,
	);
	newFloorState = enemyResult.floorState;

	const newFloors = state.floors.slice();
	newFloors[fi] = { ...floor, state: newFloorState };

	let newState: GameState = {
		...state,
		turn: state.turn + 1,
		floors: newFloors,
		rngState: getRngState(),
	};
	const events: GameEvent[] = [...moveEvents, ...enemyResult.events];

	// Auto-descend: hero stepped onto the exit tile and a next floor exists
	const heroAfterMove = newFloorState.actorsById[state.heroId];
	if (
		heroAfterMove?.alive &&
		floor.state.exitIdx !== null &&
		newIdx === floor.state.exitIdx &&
		fi < state.floors.length - 1
	) {
		const nextFi = fi + 1;
		const nextFloor = newState.floors[nextFi];
		if (nextFloor) {
			// Remove hero from current floor, place on next floor at spawn
			const departingFloorState: FloorState = {
				...newFloorState,
				actorsById: Object.fromEntries(
					Object.entries(newFloorState.actorsById).filter(([id]) => id !== state.heroId),
				),
			};
			const descendingHero: Actor = {
				...heroAfterMove,
				idx: nextFloor.state.spawnIdx,
			};

			// Compute initial visibility on next floor
			const nextWidth = nextFloor.config.width;
			const nextHeight = nextFloor.config.height;
			const nextOpMask = context.getOpacityMask(nextFi);
			const { x: spawnX, y: spawnY } = idxToXY(nextFloor.state.spawnIdx, nextWidth);
			const nextVisible = computeVisibility(
				spawnX,
				spawnY,
				nextWidth,
				nextHeight,
				nextOpMask,
				VISION_RADIUS,
			);
			const nextExplored = mergeExplored(
				nextFloor.state.explored,
				nextVisible,
				nextWidth * nextHeight,
			);

			const nextFloorState: FloorState = {
				...nextFloor.state,
				actorsById: {
					...nextFloor.state.actorsById,
					[state.heroId]: descendingHero,
				},
				explored: nextExplored,
			};

			const descendFloors = newState.floors.slice();
			descendFloors[fi] = { ...newState.floors[fi]!, state: departingFloorState };
			descendFloors[nextFi] = { ...nextFloor, state: nextFloorState };

			events.push({ type: "descend", fromFloor: fi, toFloor: nextFi });

			newState = {
				...newState,
				heroFloorIndex: nextFi,
				floors: descendFloors,
			};
		}
	}

	const { state: tickedMoveState, events: tickMoveEvents } = tickActiveEffects(newState);
	newState = tickSkillCooldowns(tickedMoveState);
	events.push(...tickMoveEvents);

	return { ok: true, state: newState, events };
}
