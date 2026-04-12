import { itemsById, affixesById } from "@app/content";
import type { ItemDefinition, AffixDefinition } from "@app/content";
import { getHero } from "@app/shared";
import type { EquipmentSlots, ItemInstance } from "@app/shared";
import { useGameStore } from "../features/game/gameStore";
import { useUiStore } from "../features/ui/uiStore";
import { Modal } from "./Modal";
import { Tooltip } from "./Tooltip";
import { ItemTooltip } from "./ItemTooltip";
import { rarityTextClass } from "../lib/rarityColors";

interface SlotDef {
	key: keyof EquipmentSlots;
	label: string;
}

const SLOT_LAYOUT: SlotDef[] = [
	{ key: "mainHand", label: "Main Hand" },
	{ key: "offHand", label: "Off Hand" },
	{ key: "head", label: "Head" },
	{ key: "body", label: "Body" },
	{ key: "hands", label: "Hands" },
	{ key: "feet", label: "Feet" },
	{ key: "ring1", label: "Ring 1" },
	{ key: "ring2", label: "Ring 2" },
	{ key: "amulet", label: "Amulet" },
];

function itemTypeLabel(def: ItemDefinition): string {
	if (def.type === "weapon") {
		return def.weaponCategory.charAt(0).toUpperCase() + def.weaponCategory.slice(1);
	}
	if (def.type === "armor" && def.slot === "body") {
		return def.armorCategory.charAt(0).toUpperCase() + def.armorCategory.slice(1) + " Armor";
	}
	if (def.type === "armor") return "Armor";
	if (def.type === "shield") return "Shield";
	if (def.type === "accessory") return "Accessory";
	return "";
}

function resolveTooltipData(
	slotId: string | undefined,
	instances: Record<string, ItemInstance>,
): { instance: ItemInstance; def: ItemDefinition; affixDefs: AffixDefinition[] } | null {
	if (!slotId) return null;

	// Check if this is an instance ID
	const instance = instances[slotId];
	if (instance) {
		const def = itemsById[instance.baseItemId as keyof typeof itemsById];
		if (!def) return null;
		const affixDefs = instance.affixIds
			.map((id) => affixesById[id])
			.filter((a): a is AffixDefinition => a !== undefined);
		return { instance, def, affixDefs };
	}

	// Otherwise treat as a base item ID (starting equipment)
	const def = itemsById[slotId as keyof typeof itemsById];
	if (!def) return null;
	const syntheticInstance: ItemInstance = {
		instanceId: slotId,
		baseItemId: slotId,
		rarity: "common",
		enhancementBonus: 0,
		affixIds: [],
		generatedName: def.name,
	};
	return { instance: syntheticInstance, def, affixDefs: [] };
}

export function InventoryModal() {
	const state = useGameStore((s) => s.state);
	const openModal = useUiStore((s) => s.openModal);
	const close = useUiStore((s) => s.close);

	const hero = state ? getHero(state) : undefined;

	return (
		<Modal open={openModal === "inventory"} onClose={close} title="Inventory">
			{hero ? (
				<div className="space-y-1">
					{SLOT_LAYOUT.map(({ key, label }) => {
						const slotId = hero.equipment[key];
						const tooltipData = resolveTooltipData(slotId, hero.itemInstances);
						const color = tooltipData
							? rarityTextClass(tooltipData.instance.rarity)
							: "text-text-muted";
						return (
							<div
								key={key}
								className="grid gap-x-3 items-baseline"
								style={{ gridTemplateColumns: "6rem 1fr auto" }}
							>
								<span className="text-text-label">{label}</span>
								{tooltipData ? (
									<Tooltip
										content={
											<ItemTooltip
												instance={tooltipData.instance}
												def={tooltipData.def}
												affixDefs={tooltipData.affixDefs}
											/>
										}
										side="right"
									>
										<span
											className={`font-mono truncate cursor-default ${color}`}
										>
											{tooltipData.instance.generatedName}
										</span>
									</Tooltip>
								) : (
									<span className="font-mono truncate text-text-muted">
										— Empty —
									</span>
								)}
								<span className="text-text-muted shrink-0">
									{tooltipData ? itemTypeLabel(tooltipData.def) : ""}
								</span>
							</div>
						);
					})}
				</div>
			) : (
				<p className="text-text-muted italic">No hero data.</p>
			)}
		</Modal>
	);
}
