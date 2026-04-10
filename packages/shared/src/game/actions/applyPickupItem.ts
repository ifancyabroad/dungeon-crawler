import type { PickupItemAction } from "./schemas";
import type { Actor, EquipmentSlots, GameState, LootDrop, PendingInteraction } from "../types";
import type { ApplyActionContext, ApplyActionResult } from "../engineContext";
import type { ItemInstance } from "../../items/types";
import { applyEquipment } from "../../items/applyEquipment";
import { getHero } from "../engineUtils";

export function applyPickupItem(
	action: PickupItemAction,
	state: GameState,
	context: ApplyActionContext,
): ApplyActionResult {
	const pi = state.pendingInteraction;
	if (pi?.type !== "loot_pickup") return { ok: false, reason: "no_pending_loot" };
	if (pi.tileIdx !== action.tileIdx) return { ok: false, reason: "loot_tile_mismatch" };
	if (!context.itemsById) return { ok: false, reason: "no_item_defs" };

	const fi = state.heroFloorIndex;
	const floor = state.floors[fi];
	if (!floor) return { ok: false, reason: "no_floor" };
	const hero = getHero(state);
	if (!hero) return { ok: false, reason: "no_hero" };

	const instanceIdx = pi.loot.items.findIndex((i) => i.instanceId === action.instanceId);
	if (instanceIdx === -1) return { ok: false, reason: "item_not_in_loot" };
	const instance = pi.loot.items[instanceIdx]!;
	const baseDef = context.itemsById[instance.baseItemId];
	if (!baseDef) return { ok: false, reason: "item_def_not_found" };

	// Determine target slot.
	let targetSlot: keyof EquipmentSlots | null = null;
	if (baseDef.type === "weapon") targetSlot = "mainHand";
	else if (baseDef.type === "shield") targetSlot = "offHand";
	else if (baseDef.type === "armor") {
		const s = baseDef.slot;
		targetSlot =
			s === "body" ? "body" : s === "head" ? "head" : s === "hands" ? "hands" : "feet";
	} else if (baseDef.type === "accessory") {
		if (baseDef.slot === "ring") {
			targetSlot = !hero.equipment.ring1 ? "ring1" : "ring2";
		} else {
			targetSlot = "amulet";
		}
	}
	if (!targetSlot) return { ok: false, reason: "item_slot_unknown" };

	// Update hero's equipment and instance registry.
	const updatedEquipment: EquipmentSlots = {
		...hero.equipment,
		[targetSlot]: instance.instanceId,
	};
	const updatedInstances: Record<string, ItemInstance> = {
		...hero.itemInstances,
		[instance.instanceId]: instance,
	};
	let heroAfterEquip: Actor = {
		...hero,
		equipment: updatedEquipment,
		itemInstances: updatedInstances,
	};
	heroAfterEquip = applyEquipment(
		heroAfterEquip,
		context.itemsById,
		heroAfterEquip.itemInstances,
		context.affixesById ?? {},
	);

	// Remove taken item from loot pile.
	const remainingItems = pi.loot.items.filter((_, i) => i !== instanceIdx);
	const updatedLoot: LootDrop = { ...pi.loot, items: remainingItems };
	const idxKey = String(pi.tileIdx);

	let updatedLootByIdx: Record<string, LootDrop>;
	let updatedTileOverrides: Record<string, number>;
	let newPendingInteraction: PendingInteraction;

	const pileEmpty = remainingItems.length === 0 && !updatedLoot.gold;
	if (pileEmpty) {
		updatedLootByIdx = { ...floor.state.lootByIdx };
		delete updatedLootByIdx[idxKey];
		updatedTileOverrides = { ...floor.state.tileOverrides };
		delete updatedTileOverrides[idxKey];
		newPendingInteraction = null;
	} else {
		updatedLootByIdx = { ...floor.state.lootByIdx, [idxKey]: updatedLoot };
		// Update tile to gold-only if items are all taken but gold remains.
		const newTileId = remainingItems.length > 0 ? 827 : 825;
		updatedTileOverrides = { ...floor.state.tileOverrides, [idxKey]: newTileId };
		newPendingInteraction = { ...pi, loot: updatedLoot };
	}

	const pickupFloors = state.floors.slice();
	pickupFloors[fi] = {
		...floor,
		state: {
			...floor.state,
			actorsById: { ...floor.state.actorsById, [state.heroId]: heroAfterEquip },
			lootByIdx: updatedLootByIdx,
			tileOverrides: updatedTileOverrides,
		},
	};

	return {
		ok: true,
		state: {
			...state,
			turn: state.turn + 1,
			floors: pickupFloors,
			pendingInteraction: newPendingInteraction,
		},
		events: [
			{
				type: "item_looted",
				actorId: state.heroId,
				item: instance,
				slot: targetSlot,
			},
		],
	};
}
