/**
 * LootPickupModal — shown when the hero steps on a loot pile that contains items.
 *
 * Driven by `state.pendingInteraction.type === "loot_pickup"`.
 * Cannot be dismissed — the player must take or leave each item.
 */

import { useState } from "react";
import { itemsById } from "@app/content";
import { getHero } from "@app/shared";
import type { ItemInstance } from "@app/shared";
import { useGameStore } from "../features/game/gameStore";
import { Modal } from "./Modal";
import { Button } from "./Button";

type ItemRarity = "common" | "uncommon" | "rare" | "epic" | "unique";

const RARITY_COLOR: Record<ItemRarity, string> = {
	common: "text-white",
	uncommon: "text-green-400",
	rare: "text-blue-400",
	epic: "text-purple-400",
	unique: "text-yellow-400",
};

function rarityColor(rarity: ItemRarity): string {
	return RARITY_COLOR[rarity] ?? "text-white";
}

function itemStatSummary(instance: ItemInstance): string {
	const baseDef = itemsById[instance.baseItemId as keyof typeof itemsById];
	if (!baseDef) return "";
	if (baseDef.type === "weapon") {
		return `${baseDef.damageDice} ${baseDef.damageType}`;
	}
	if (baseDef.type === "armor") {
		const bonus = instance.enhancementBonus > 0 ? ` +${instance.enhancementBonus}` : "";
		return `AC ${baseDef.baseAC}${bonus}`;
	}
	if (baseDef.type === "shield") {
		return `+${baseDef.acBonus} AC`;
	}
	if (baseDef.type === "accessory") {
		return baseDef.effects.map((e) => e.type.replace(/_/g, " ")).join(", ");
	}
	return "";
}

export function LootPickupModal() {
	const state = useGameStore((s) => s.state);
	const sendAction = useGameStore((s) => s.sendAction);
	const actionInProgress = useGameStore((s) => s.actionInProgress);
	const [confirmItemId, setConfirmItemId] = useState<string | null>(null);

	const pi = state?.pendingInteraction;
	if (!pi || pi.type !== "loot_pickup") return null;

	const { tileIdx, loot } = pi;
	const hero = state ? getHero(state) : undefined;

	function handleTakeGold() {
		sendAction({ type: "pickup_gold", tileIdx });
	}

	function handleEquip(instance: ItemInstance) {
		if (confirmItemId === instance.instanceId) {
			sendAction({ type: "pickup_item", tileIdx, instanceId: instance.instanceId });
			setConfirmItemId(null);
		} else {
			// Check if the target slot is occupied — if so require confirmation.
			const baseDef = itemsById[instance.baseItemId as keyof typeof itemsById];
			if (!baseDef || !hero) {
				sendAction({ type: "pickup_item", tileIdx, instanceId: instance.instanceId });
				return;
			}

			let currentSlot: string | undefined;
			if (baseDef.type === "weapon") currentSlot = hero.equipment.mainHand;
			else if (baseDef.type === "shield") currentSlot = hero.equipment.offHand;
			else if (baseDef.type === "armor") {
				const slot = baseDef.slot as "body" | "head" | "hands" | "feet";
				currentSlot = hero.equipment[slot];
			} else if (baseDef.type === "accessory") {
				if (baseDef.slot === "ring") {
					currentSlot = hero.equipment.ring1 ?? hero.equipment.ring2;
				} else {
					currentSlot = hero.equipment.amulet;
				}
			}

			if (currentSlot) {
				setConfirmItemId(instance.instanceId);
			} else {
				sendAction({ type: "pickup_item", tileIdx, instanceId: instance.instanceId });
			}
		}
	}

	function handleLeaveAll() {
		setConfirmItemId(null);
		sendAction({ type: "leave_loot", tileIdx });
	}

	return (
		<Modal open onClose={() => {}} title="Loot Found">
			<div className="space-y-3">
				{/* Gold */}
				{loot.gold !== undefined && loot.gold > 0 && (
					<div className="flex items-center justify-between border border-border px-3 py-2">
						<span className="text-yellow-400 font-mono">{loot.gold} Gold</span>
						<Button
							variant="secondary"
							size="sm"
							onClick={handleTakeGold}
							disabled={actionInProgress}
						>
							Take
						</Button>
					</div>
				)}

				{/* Items */}
				{loot.items.map((instance) => {
					const rarity = instance.rarity as ItemRarity;
					const isConfirming = confirmItemId === instance.instanceId;
					return (
						<div
							key={instance.instanceId}
							className="border border-border px-3 py-2 space-y-1"
						>
							<div className="flex items-start justify-between gap-2">
								<div className="min-w-0">
									<p className={`font-mono ${rarityColor(rarity)}`}>
										{instance.generatedName}
									</p>
									<p className="text-text-muted text-sm">
										{itemStatSummary(instance)}
									</p>
									{isConfirming && (
										<p className="text-amber-400 text-sm mt-0.5">
											Replaces equipped item. Confirm?
										</p>
									)}
								</div>
								<Button
									variant={isConfirming ? "primary" : "secondary"}
									size="sm"
									onClick={() => handleEquip(instance)}
									disabled={actionInProgress}
								>
									{isConfirming ? "Confirm" : "Equip"}
								</Button>
							</div>
						</div>
					);
				})}

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
	);
}
