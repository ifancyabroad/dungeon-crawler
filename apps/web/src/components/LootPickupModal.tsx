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
	equippedInstance: ItemInstance;
	equippedDef: ItemDefinition;
	equippedAffixDefs: AffixDefinition[];
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
		return hero.itemInstances[slotId] ?? null;
	}

	function handleEquip(instance: ItemInstance) {
		const equipped = getEquippedInSlot(instance);
		if (equipped) {
			const incomingDef = itemsById[instance.baseItemId as keyof typeof itemsById];
			const equippedDef = itemsById[equipped.baseItemId as keyof typeof itemsById];
			if (!incomingDef || !equippedDef) {
				sendAction({ type: "pickup_item", tileIdx, instanceId: instance.instanceId });
				return;
			}
			setPendingEquip({
				incomingInstance: instance,
				incomingDef,
				incomingAffixDefs: resolveAffixes(instance),
				equippedInstance: equipped,
				equippedDef,
				equippedAffixDefs: resolveAffixes(equipped),
			});
		} else {
			sendAction({ type: "pickup_item", tileIdx, instanceId: instance.instanceId });
		}
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
