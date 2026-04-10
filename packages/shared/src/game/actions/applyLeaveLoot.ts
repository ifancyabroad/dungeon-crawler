import type { LeaveLootAction } from "./schemas";
import type { GameState } from "../types";
import type { ApplyActionResult } from "../engineContext";

export function applyLeaveLoot(action: LeaveLootAction, state: GameState): ApplyActionResult {
	const pi = state.pendingInteraction;
	if (pi?.type !== "loot_pickup") return { ok: false, reason: "no_pending_loot" };
	if (pi.tileIdx !== action.tileIdx) return { ok: false, reason: "loot_tile_mismatch" };

	const fi = state.heroFloorIndex;
	const floor = state.floors[fi];
	if (!floor) return { ok: false, reason: "no_floor" };

	const idxKey = String(pi.tileIdx);
	const clearedLootByIdx = { ...floor.state.lootByIdx };
	delete clearedLootByIdx[idxKey];
	const clearedTileOverrides = { ...floor.state.tileOverrides };
	delete clearedTileOverrides[idxKey];

	const leaveFloors = state.floors.slice();
	leaveFloors[fi] = {
		...floor,
		state: {
			...floor.state,
			lootByIdx: clearedLootByIdx,
			tileOverrides: clearedTileOverrides,
		},
	};

	return {
		ok: true,
		state: {
			...state,
			turn: state.turn + 1,
			floors: leaveFloors,
			pendingInteraction: null,
		},
		events: [],
	};
}
