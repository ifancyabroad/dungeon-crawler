/**
 * LootPickupModal — shown when the hero steps on a loot pile that contains items.
 *
 * Driven by `state.pendingInteraction.type === "loot_pickup"`.
 * Cannot be dismissed — the player must take or leave each item.
 */

import { useState } from "react";
import { affixesById, itemsById } from "@app/content";
import type { AffixDefinition, ItemDefinition } from "@app/content";
import { getHero } from "@app/shared";
import type { ItemInstance } from "@app/shared";
import { useGameStore } from "../features/game/gameStore";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { LootItemCard } from "./LootItemCard";
import { ConfirmReplaceModal } from "./ConfirmReplaceModal";

type PendingEquip = {
	incomingInstance: ItemInstance;
	incomingDef: ItemDefinition;
	incomingAffixDefs: AffixDefinition[];
	equippedInstance?: ItemInstance;
	equippedDef?: ItemDefinition;
	equippedAffixDefs: AffixDefinition[];
	sideEffectInstance?: ItemInstance;
	sideEffectDef?: ItemDefinition;
};

function resolveAffixes(instance: ItemInstance): AffixDefinition[] {
	return instance.affixIds
		.map((id) => affixesById[id as keyof typeof affixesById])
		.filter((a): a is AffixDefinition => a != null);
}

export function LootPickupModal() {
	const state = useGameStore((s) => s.state);
	const sendAction = useGameStore((s) => s.sendAction);
	const actionInProgress = useGameStore((s) => s.actionInProgress);
	const [pendingEquip, setPendingEquip] = useState<PendingEquip | null>(null);

	const pi = state?.pendingInteraction;
	if (!pi || pi.type !== "loot_pickup") return null;

	const { tileIdx, loot } = pi;
	const hero = state ? getHero(state) : undefined;

	// Resolves the instance currently occupying a slot, handling both looted items (instanceId in
	// slot) and starting equipment (base item ID stored directly in slot with no ItemInstance).
	function resolveSlotInstance(slotId: string): ItemInstance | null {
		if (!hero) return null;
		const inst = hero.itemInstances[slotId];
		if (inst) return inst;
		const def = itemsById[slotId as keyof typeof itemsById];
		if (!def) return null;
		return {
			instanceId: slotId,
			baseItemId: slotId,
			rarity: "common",
			enhancementBonus: 0,
			affixIds: [],
			generatedName: def.name,
		};
	}

	function getEquippedInSlot(instance: ItemInstance): ItemInstance | null {
		const baseDef = itemsById[instance.baseItemId as keyof typeof itemsById];
		if (!baseDef || !hero) return null;

		let slotId: string | null | undefined;
		if (baseDef.type === "weapon") slotId = hero.equipment.mainHand;
		else if (baseDef.type === "shield") slotId = hero.equipment.offHand;
		else if (baseDef.type === "armor") {
			slotId = hero.equipment[baseDef.slot as "body" | "head" | "hands" | "feet"];
		} else if (baseDef.type === "accessory") {
			slotId =
				baseDef.slot === "ring"
					? (hero.equipment.ring1 ?? hero.equipment.ring2)
					: hero.equipment.amulet;
		}

		if (!slotId) return null;
		return resolveSlotInstance(slotId);
	}

	function getSideEffectSlot(instance: ItemInstance): ItemInstance | null {
		if (!hero) return null;
		const incomingDef = itemsById[instance.baseItemId as keyof typeof itemsById];
		if (!incomingDef) return null;

		if (incomingDef.type === "weapon" && incomingDef.properties.includes("two_handed")) {
			// Two-handed weapon being equipped: offHand will be cleared
			return hero.equipment.offHand ? resolveSlotInstance(hero.equipment.offHand) : null;
		}

		if (incomingDef.type === "shield") {
			// Offhand being equipped: mainHand will be cleared if it holds a two-handed weapon
			const mainHandId = hero.equipment.mainHand;
			if (!mainHandId) return null;
			const mainHandInst = hero.itemInstances[mainHandId];
			const mainHandBaseId = mainHandInst?.baseItemId ?? mainHandId;
			const mainHandDef = itemsById[mainHandBaseId as keyof typeof itemsById];
			if (mainHandDef?.type !== "weapon" || !mainHandDef.properties.includes("two_handed"))
				return null;
			return resolveSlotInstance(mainHandId);
		}

		return null;
	}

	function handleEquip(instance: ItemInstance) {
		const incomingDef = itemsById[instance.baseItemId as keyof typeof itemsById];
		if (!incomingDef) {
			sendAction({ type: "pickup_item", tileIdx, instanceId: instance.instanceId });
			return;
		}

		const equipped = getEquippedInSlot(instance);
		const sideEffectInstance = getSideEffectSlot(instance);

		if (!equipped && !sideEffectInstance) {
			sendAction({ type: "pickup_item", tileIdx, instanceId: instance.instanceId });
			return;
		}

		const equippedDef = equipped
			? itemsById[equipped.baseItemId as keyof typeof itemsById]
			: undefined;
		const sideEffectDef = sideEffectInstance
			? itemsById[sideEffectInstance.baseItemId as keyof typeof itemsById]
			: undefined;

		setPendingEquip({
			incomingInstance: instance,
			incomingDef,
			incomingAffixDefs: resolveAffixes(instance),
			equippedInstance: equipped ?? undefined,
			equippedDef,
			equippedAffixDefs: equipped ? resolveAffixes(equipped) : [],
			sideEffectInstance: sideEffectInstance ?? undefined,
			sideEffectDef,
		});
	}

	function handleConfirmReplace() {
		if (pendingEquip) {
			sendAction({
				type: "pickup_item",
				tileIdx,
				instanceId: pendingEquip.incomingInstance.instanceId,
			});
			setPendingEquip(null);
		}
	}

	function handleLeaveAll() {
		setPendingEquip(null);
		sendAction({ type: "leave_loot", tileIdx });
	}

	return (
		<>
			<Modal open onClose={() => {}} title="Loot Found">
				<div className="space-y-4">
					<p className="text-text-bright leading-snug font-mono">
						{pi.collectedGold ? (
							<>
								You collected{" "}
								<span className="text-yellow-400">{pi.collectedGold} gold</span> and
								found the following:
							</>
						) : (
							"You search the area and find the following:"
						)}
					</p>

					{/* Items */}
					{loot.items.length > 0 && (
						<div className="space-y-1">
							{loot.items.map((instance) => {
								const baseDef =
									itemsById[instance.baseItemId as keyof typeof itemsById];
								if (!baseDef) return null;
								const equipped = getEquippedInSlot(instance);
								const equippedDef = equipped
									? itemsById[equipped.baseItemId as keyof typeof itemsById]
									: null;
								return (
									<LootItemCard
										key={instance.instanceId}
										instance={instance}
										def={baseDef}
										affixDefs={resolveAffixes(instance)}
										equippedInSlot={equipped}
										equippedDef={equippedDef}
										equippedAffixDefs={
											equipped ? resolveAffixes(equipped) : undefined
										}
										onEquip={() => handleEquip(instance)}
										disabled={actionInProgress}
									/>
								);
							})}
						</div>
					)}

					{/* Leave all */}
					<div className="border-t border-border pt-3">
						<Button
							variant="secondary"
							size="sm"
							onClick={handleLeaveAll}
							disabled={actionInProgress}
						>
							Leave all
						</Button>
					</div>
				</div>
			</Modal>

			{pendingEquip && (
				<ConfirmReplaceModal
					{...pendingEquip}
					onConfirm={handleConfirmReplace}
					onCancel={() => setPendingEquip(null)}
				/>
			)}
		</>
	);
}
