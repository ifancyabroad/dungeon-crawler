import type { ItemRarity } from "@app/shared";

export const RARITY_TEXT: Record<ItemRarity, string> = {
	common: "text-white",
	uncommon: "text-green-400",
	rare: "text-blue-400",
	epic: "text-purple-400",
	unique: "text-yellow-400",
};

export function rarityTextClass(rarity: ItemRarity): string {
	return RARITY_TEXT[rarity];
}
