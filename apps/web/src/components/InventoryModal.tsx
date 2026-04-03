import { itemsById } from "@app/content";
import { getHero } from "@app/shared";
import type { EquipmentSlots, ItemInstance } from "@app/shared";
import { useGameStore } from "../features/game/gameStore";
import { useUiStore } from "../features/ui/uiStore";
import { Modal } from "./Modal";

type ItemRarity = "common" | "uncommon" | "rare" | "epic" | "unique";

const RARITY_COLOR: Record<ItemRarity, string> = {
	common: "text-white",
	uncommon: "text-green-400",
	rare: "text-blue-400",
	epic: "text-purple-400",
	unique: "text-yellow-400",
};

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

function resolveItemDisplay(
	slotId: string | undefined,
	instances: Record<string, ItemInstance>,
): { name: string; rarity: ItemRarity; stat: string } | null {
	if (!slotId) return null;

	// Check if this is an instance ID
	const instance = instances[slotId];
	if (instance) {
		const baseDef = itemsById[instance.baseItemId as keyof typeof itemsById];
		return {
			name: instance.generatedName,
			rarity: instance.rarity as ItemRarity,
			stat: baseDef
				? baseDef.type === "weapon"
					? `${baseDef.damageDice} ${baseDef.damageType}`
					: baseDef.type === "armor"
						? `AC ${baseDef.baseAC}${instance.enhancementBonus > 0 ? ` +${instance.enhancementBonus}` : ""}`
						: baseDef.type === "shield"
							? `+${baseDef.acBonus} AC`
							: ""
				: "",
		};
	}

	// Otherwise treat as a base item ID
	const baseDef = itemsById[slotId as keyof typeof itemsById];
	if (!baseDef) return null;
	return {
		name: baseDef.name,
		rarity: "common",
		stat:
			baseDef.type === "weapon"
				? `${baseDef.damageDice} ${baseDef.damageType}`
				: baseDef.type === "armor"
					? `AC ${baseDef.baseAC}`
					: baseDef.type === "shield"
						? `+${baseDef.acBonus} AC`
						: baseDef.type === "accessory"
							? baseDef.effects.map((e) => e.type.replace(/_/g, " ")).join(", ")
							: "",
	};
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
						const item = resolveItemDisplay(slotId, hero.itemInstances);
						const color = item
							? (RARITY_COLOR[item.rarity] ?? "text-white")
							: "text-text-muted";
						return (
							<div
								key={key}
								className="grid gap-x-3 items-baseline"
								style={{ gridTemplateColumns: "6rem 1fr auto" }}
							>
								<span className="text-text-label">{label}</span>
								<span className={`font-mono truncate ${color}`}>
									{item ? item.name : "— Empty —"}
								</span>
								{item && (
									<span className="text-text-muted shrink-0">{item.stat}</span>
								)}
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
