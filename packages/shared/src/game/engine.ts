/**
 * Deterministic game engine: create initial state and apply actions.
 * Walkability: pass via context.getWalkableMask (required in production; use applyActionWithDerivedContext for dev/test).
 * RNG state is only advanced when an action actually uses RNG (e.g. future spawns/combat).
 */

import type { Action } from "./actions";
import type { FloorConfig, GameState, PersistedDynamicState } from "./types";
import { computeWalkableMaskForFloor, regenerateBaseMaps } from "../map";
import { computeOpacityMask } from "../map/visibility";

import type { ApplyActionContext, ApplyActionResult } from "./engineContext";
import { createActionContext, createEmptyFloorState } from "./engineContext";
import { applyMove } from "./actions/applyMove";
import { applyAttack } from "./actions/applyAttack";
import { applyUseSkill } from "./actions/applyUseSkill";
import { applySelectSkillChoice } from "./actions/applySelectSkillChoice";
import { applyRerollSkillChoice } from "./actions/applyRerollSkillChoice";
import { applyPickupItem } from "./actions/applyPickupItem";
import { applyPickupGold } from "./actions/applyPickupGold";
import { applyLeaveLoot } from "./actions/applyLeaveLoot";

// ---------------------------------------------------------------------------
// Re-exports for consumers that import implementation helpers from `engine/`
// ---------------------------------------------------------------------------

export {
	actorKind,
	DIRECTION_DELTA,
	findAdjacentWalkable,
	getActorAtIdx,
	getAdjacentIndices,
	getAdjacentIndices8,
	getHero,
	idxToXY,
	isSqueezeBlocked,
	xyToIdx,
} from "./engineUtils";
export {
	createActionContext,
	createEmptyFloorState,
	type ApplyActionContext,
	type ApplyActionResult,
	type ClassSkillPools,
} from "./engineContext";
export { createInitialState, DEFAULT_HERO_INIT, resetNpcCounter, spawnNpc } from "./engineInit";
export { generateSkillOffers, checkForLevelUp, grantXp } from "./engineLevelUp";

// ---------------------------------------------------------------------------
// Apply action
// ---------------------------------------------------------------------------

/**
 * Apply one action to state. Context is required (use applyActionWithDerivedContext in dev/test only).
 * RNG is advanced only when the action involves combat.
 * After every successful player action, enemy turns are processed.
 */
export function applyAction(
	state: GameState,
	action: Action,
	context: ApplyActionContext,
): ApplyActionResult {
	// -------------------------------------------------------------------------
	// Pause gate: when a pendingInteraction is active, all regular game actions
	// are blocked. Only meta-actions that resolve the interaction may proceed.
	// -------------------------------------------------------------------------
	const isInteractionAction =
		action.type === "select_skill_choice" ||
		action.type === "reroll_skill_choice" ||
		action.type === "pickup_item" ||
		action.type === "pickup_gold" ||
		action.type === "leave_loot";
	if (state.pendingInteraction !== null && !isInteractionAction) {
		return { ok: false, reason: "interaction_required" };
	}

	switch (action.type) {
		case "move":
			return applyMove(action, state, context);
		case "attack":
			return applyAttack(action, state, context);
		case "use_skill":
			return applyUseSkill(action, state, context);
		case "select_skill_choice":
			return applySelectSkillChoice(action, state, context);
		case "reroll_skill_choice":
			return applyRerollSkillChoice(action, state, context);
		case "pickup_item":
			return applyPickupItem(action, state, context);
		case "pickup_gold":
			return applyPickupGold(action, state);
		case "leave_loot":
			return applyLeaveLoot(action, state);
		case "unknown":
			return { ok: false, reason: "unknown_action" };
		default: {
			const _exhaustive: never = action;
			void _exhaustive;
			return { ok: false, reason: "unknown_action" };
		}
	}
}

// ---------------------------------------------------------------------------
// Dev/test helper + persistence
// ---------------------------------------------------------------------------

/**
 * Dev/test only: build context from state (regenerateBaseMaps + masks per floor) and apply action.
 * Do not use in production API; production must pass context from cache.
 */
export function applyActionWithDerivedContext(state: GameState, action: Action): ApplyActionResult {
	const baseLayers = regenerateBaseMaps(
		state.seed,
		state.floors.map((f) => f.config),
		state.mapGenVersion,
	);
	const walkableMasks = baseLayers.map((base, i) =>
		computeWalkableMaskForFloor(base, state.floors[i]?.state.tileOverrides ?? {}),
	);
	const opacityMasks = baseLayers.map((base) =>
		computeOpacityMask(base.wall, base.width, base.height),
	);
	const context = createActionContext(walkableMasks, opacityMasks);
	return applyAction(state, action, context);
}

/**
 * Build full GameState from persisted dynamic state + session metadata.
 * No walkableByFloor on returned state.
 */
export function buildGameStateFromPersisted(
	seed: number,
	mapGenVersion: number,
	floorConfigs: FloorConfig[],
	persisted: PersistedDynamicState,
): GameState {
	const defaultFloorState = createEmptyFloorState();
	const floors = floorConfigs.map((config, i) => ({
		config,
		state: persisted.floors[i] ?? defaultFloorState,
	}));
	return {
		turn: persisted.turn,
		heroId: persisted.heroId,
		heroFloorIndex: persisted.heroFloorIndex,
		seed,
		mapGenVersion,
		floors,
		rngState: persisted.rngState,
		pendingInteraction: persisted.pendingInteraction ?? null,
	};
}

/** Convert full GameState to persisted dynamic state (for snapshots). Single source of truth for the shape. */
export function gameStateToPersisted(state: GameState): PersistedDynamicState {
	return {
		turn: state.turn,
		heroId: state.heroId,
		heroFloorIndex: state.heroFloorIndex,
		floors: state.floors.map((f) => f.state),
		rngState: state.rngState,
		pendingInteraction: state.pendingInteraction,
	};
}
