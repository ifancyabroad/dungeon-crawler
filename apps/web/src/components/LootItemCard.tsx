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
	equippedDef?: ItemDefinition | null;
	equippedAffixDefs?: AffixDefinition[];
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
	equippedDef,
	equippedAffixDefs = [],
	onEquip,
	disabled,
}: LootItemCardProps) {
	const rarityText = RARITY_TEXT[instance.rarity];
	const slotLabel = getSlotLabel(def);

	const incomingTooltip = <ItemTooltip instance={instance} def={def} affixDefs={affixDefs} />;

	return (
		<>
			<Tooltip content={incomingTooltip} side="right">
				<div className="w-full px-3 py-2 border transition-colors border-border hover:border-border-bright hover:bg-bg-elevated">
					<div className="flex items-center justify-between gap-2">
						<div className="flex items-center gap-2 min-w-0">
							<span className={`font-mono truncate ${rarityText}`}>
								{instance.generatedName}
							</span>
							<span className="shrink-0 text-xs font-mono px-1 border border-border text-text-muted uppercase tracking-wide">
								{slotLabel}
							</span>
						</div>
						<Button variant="secondary" size="sm" disabled={disabled} onClick={onEquip}>
							Equip
						</Button>
					</div>
				</div>
			</Tooltip>
			{equippedInSlot && equippedDef && (
				<Tooltip
					content={
						<ItemTooltip
							instance={equippedInSlot}
							def={equippedDef}
							affixDefs={equippedAffixDefs}
						/>
					}
					side="right"
				>
					<p className="font-mono text-sm px-3 py-0.5 cursor-default">
						<span className="text-text-label">Equipped: </span>
						<span className={RARITY_TEXT[equippedInSlot.rarity]}>
							{equippedInSlot.generatedName}
						</span>
					</p>
				</Tooltip>
			)}
		</>
	);
}
