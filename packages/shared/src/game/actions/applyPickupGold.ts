import type { PickupGoldAction } from "./schemas";
import type { Actor, GameState, LootDrop, PendingInteraction } from "../types";
import type { ApplyActionResult } from "../engineContext";
import { getHero } from "../engineUtils";

export function applyPickupGold(action: PickupGoldAction, state: GameState): ApplyActionResult {
	const pi = state.pendingInteraction;
	if (pi?.type !== "loot_pickup") return { ok: false, reason: "no_pending_loot" };
	if (pi.tileIdx !== action.tileIdx) return { ok: false, reason: "loot_tile_mismatch" };
	if (!pi.loot.gold) return { ok: false, reason: "no_gold_in_loot" };

	const fi = state.heroFloorIndex;
	const floor = state.floors[fi];
	if (!floor) return { ok: false, reason: "no_floor" };
	const hero = getHero(state);
	if (!hero) return { ok: false, reason: "no_hero" };

	const goldAmount = pi.loot.gold;
	const heroWithGold: Actor = { ...hero, gold: hero.gold + goldAmount };
	const updatedLoot: LootDrop = { ...pi.loot, gold: undefined };
	const idxKey = String(pi.tileIdx);

	let updatedLootByIdx: Record<string, LootDrop>;
	let updatedTileOverrides: Record<string, number>;
	let newPendingInteraction: PendingInteraction;

	const pileEmpty = updatedLoot.items.length === 0;
	if (pileEmpty) {
		updatedLootByIdx = { ...floor.state.lootByIdx };
		delete updatedLootByIdx[idxKey];
		updatedTileOverrides = { ...floor.state.tileOverrides };
		delete updatedTileOverrides[idxKey];
		newPendingInteraction = null;
	} else {
		updatedLootByIdx = { ...floor.state.lootByIdx, [idxKey]: updatedLoot };
		updatedTileOverrides = { ...floor.state.tileOverrides, [idxKey]: 827 };
		newPendingInteraction = { ...pi, loot: updatedLoot };
	}

	const goldFloors = state.floors.slice();
	goldFloors[fi] = {
		...floor,
		state: {
			...floor.state,
			actorsById: { ...floor.state.actorsById, [state.heroId]: heroWithGold },
			lootByIdx: updatedLootByIdx,
			tileOverrides: updatedTileOverrides,
		},
	};

	return {
		ok: true,
		state: {
			...state,
			turn: state.turn + 1,
			floors: goldFloors,
			pendingInteraction: newPendingInteraction,
		},
		events: [
			{
				type: "gold_collected",
				actorId: state.heroId,
				amount: goldAmount,
				tileIdx: pi.tileIdx,
			},
		],
	};
}
