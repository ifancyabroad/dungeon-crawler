import type { ItemInstance } from "@app/shared";
import type { ItemDefinition, AffixDefinition } from "@app/content";
import { Tooltip } from "./Tooltip";
import { Button } from "./Button";
import { ItemTooltip } from "./ItemTooltip";
import { RARITY_TEXT } from "../lib/rarityColors";

type LootItemCardProps = {
	instance: ItemInstance;
	def: ItemDefinition;
	affixDefs: AffixDefinition[];
	equippedInSlot?: ItemInstance | null;
	onEquip: () => void;
	disabled?: boolean;
};

function getSlotLabel(def: ItemDefinition): string {
	if (def.type === "weapon") return "Main Hand";
	if (def.type === "shield") return "Off Hand";
	const { slot } = def; // armor and accessory both have .slot
	return slot.charAt(0).toUpperCase() + slot.slice(1);
}

export function LootItemCard({
	instance,
	def,
	affixDefs,
	equippedInSlot,
	onEquip,
	disabled,
}: LootItemCardProps) {
	const rarityText = RARITY_TEXT[instance.rarity] ?? "text-white";
	const slotLabel = getSlotLabel(def);

	const incomingTooltip = <ItemTooltip instance={instance} def={def} affixDefs={affixDefs} />;

	return (
		<Tooltip content={incomingTooltip} side="right">
			<div className="w-full px-3 py-2 border transition-colors border-border hover:border-border-bright hover:bg-bg-elevated">
				<div className="flex items-start justify-between gap-2">
					<div className="flex-1 min-w-0 space-y-0.5">
						{/* Row 1: name + slot badge */}
						<div className="flex items-center gap-2 min-w-0">
							<span className={`font-mono truncate ${rarityText}`}>
								{instance.generatedName}
							</span>
							<span className="shrink-0 text-xs font-mono px-1 border border-border text-text-muted uppercase tracking-wide">
								{slotLabel}
							</span>
						</div>
						{/* Row 2: currently equipped item */}
						{equippedInSlot && (
							<p className="font-mono">
								<span className="text-text-label">Equipped:</span>{" "}
								<span
									className={RARITY_TEXT[equippedInSlot.rarity] ?? "text-white"}
								>
									{equippedInSlot.generatedName}
								</span>
							</p>
						)}
					</div>
					<Button variant="secondary" size="sm" disabled={disabled} onClick={onEquip}>
						Equip
					</Button>
				</div>
			</div>
		</Tooltip>
	);
}
