/**
 * Deterministic loot generation for NPC death drops and chest openings.
 *
 * All functions accept an `rng: () => number` (float in [0, 1)) sourced from the engine's
 * serializable RNG state — ensuring replay integrity.
 */

import type { ChestType } from "../game/types";
import type { Actor } from "../game/types";
import type { AffixDef, ItemDef, ItemInstance, ItemRarity, LootDrop } from "./types";
import { RARITY_AFFIX_COUNT, RARITY_ENHANCEMENT } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pick a weighted random entry. Weights are relative (need not sum to 1). */
function weightedPick<T extends { weight: number }>(
	entries: T[],
	rng: () => number,
): T | undefined {
	if (entries.length === 0) return undefined;
	const total = entries.reduce((s, e) => s + e.weight, 0);
	if (total <= 0) return undefined;
	let roll = rng() * total;
	for (const entry of entries) {
		roll -= entry.weight;
		if (roll <= 0) return entry;
	}
	return entries[entries.length - 1];
}

/** Return a random integer in [min, max] (inclusive). */
function randomInt(min: number, max: number, rng: () => number): number {
	return min + Math.floor(rng() * (max - min + 1));
}

/** Generate a short hex string for instanceId (8 hex chars). */
function randomHex8(rng: () => number): string {
	return Math.floor(rng() * 0xffffffff)
		.toString(16)
		.padStart(8, "0");
}

// ---------------------------------------------------------------------------
// Rarity rolling
// ---------------------------------------------------------------------------

const RARITIES: ItemRarity[] = ["common", "uncommon", "rare", "epic", "unique"];

function rollRarity(
	rarityWeights: Record<ItemRarity, number>,
	floorDepth: number,
	rng: () => number,
): ItemRarity {
	// Bias the weights toward better rarities at higher floors.
	// Each floor reduces common weight by 5 (clamped to 0) and distributes proportionally.
	const depthBoost = floorDepth * 5;
	const adjusted: Record<ItemRarity, number> = {
		common: Math.max(0, rarityWeights.common - depthBoost),
		uncommon: rarityWeights.uncommon + Math.floor(depthBoost * 0.6),
		rare: rarityWeights.rare + Math.floor(depthBoost * 0.3),
		epic: rarityWeights.epic + Math.floor(depthBoost * 0.08),
		unique: rarityWeights.unique + Math.floor(depthBoost * 0.02),
	};

	const weighted = RARITIES.map((r) => ({ rarity: r, weight: adjusted[r] })).filter(
		(e) => e.weight > 0,
	);
	const picked = weightedPick(weighted, rng);
	return picked?.rarity ?? "common";
}

// ---------------------------------------------------------------------------
// Item name generation
// ---------------------------------------------------------------------------

export function generateItemName(baseName: string, affixes: AffixDef[]): string {
	let bestPrefix: { text: string; priority: number } | undefined;
	let bestSuffix: { text: string; priority: number } | undefined;

	for (const affix of affixes) {
		if (affix.namePrefix !== undefined) {
			if (!bestPrefix || affix.namePriority > bestPrefix.priority) {
				bestPrefix = { text: affix.namePrefix, priority: affix.namePriority };
			}
		}
		if (affix.nameSuffix !== undefined) {
			if (!bestSuffix || affix.namePriority > bestSuffix.priority) {
				bestSuffix = { text: affix.nameSuffix, priority: affix.namePriority };
			}
		}
	}

	const parts: string[] = [];
	if (bestPrefix) parts.push(bestPrefix.text);
	parts.push(baseName);
	if (bestSuffix) parts.push(bestSuffix.text);
	return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Item instance generation
// ---------------------------------------------------------------------------

export function generateItemInstance(
	baseItemId: string,
	baseDef: ItemDef,
	rarity: ItemRarity,
	rng: () => number,
	affixPool: AffixDef[],
): ItemInstance {
	const instanceId = `inst_${randomHex8(rng)}`;
	const enhancementBonus = RARITY_ENHANCEMENT[rarity];
	const affixCount = RARITY_AFFIX_COUNT[rarity];

	// Determine which affixes are eligible for this item type.
	const eligibleAffixes = affixPool.filter((a) =>
		a.eligibleItemTypes.includes(baseDef.type as "weapon" | "armor" | "shield" | "accessory"),
	);

	// Pick affixes without replacement.
	const remaining = [...eligibleAffixes];
	const pickedAffixes: AffixDef[] = [];
	for (let i = 0; i < affixCount && remaining.length > 0; i++) {
		const idx = Math.floor(rng() * remaining.length);
		pickedAffixes.push(remaining[idx]);
		remaining.splice(idx, 1);
	}

	const affixIds = pickedAffixes.map((a) => a.id);
	const generatedName = generateItemName(baseDef.name, pickedAffixes);

	return { instanceId, baseItemId, rarity, enhancementBonus, affixIds, generatedName };
}

// ---------------------------------------------------------------------------
// Loot table rolling
// ---------------------------------------------------------------------------

export function rollLootDrop(
	actor: Actor,
	floorDepth: number,
	rng: () => number,
	itemsById: Record<string, ItemDef>,
	affixesById: Record<string, AffixDef>,
): LootDrop | null {
	const table = actor.lootTable;
	if (!table) return null;

	// Roll whether anything drops.
	if (rng() >= table.dropChance) return null;

	const drop: LootDrop = { items: [] };

	// Roll gold.
	if (table.gold) {
		drop.gold = randomInt(table.gold.min, table.gold.max, rng);
	}

	// Roll item.
	if (table.items && table.items.length > 0) {
		const pickedEntry = weightedPick(table.items, rng);
		if (pickedEntry) {
			const baseDef = itemsById[pickedEntry.baseItemId];
			if (baseDef) {
				const rarityWeights = table.rarityWeights ?? {
					common: 65,
					uncommon: 25,
					rare: 8,
					epic: 2,
					unique: 0,
				};
				const rarity = rollRarity(rarityWeights, floorDepth, rng);
				const affixPool = Object.values(affixesById);
				const instance = generateItemInstance(
					pickedEntry.baseItemId,
					baseDef,
					rarity,
					rng,
					affixPool,
				);
				drop.items.push(instance);
			}
		}
	}

	// Only return a drop if there's something in it.
	if (!drop.gold && drop.items.length === 0) return null;
	return drop;
}

// ---------------------------------------------------------------------------
// Chest loot rolling
// ---------------------------------------------------------------------------

interface ChestLootConfig {
	gold: { min: number; max: number };
	itemCount: { min: number; max: number };
	rarityWeights: Record<ItemRarity, number>;
}

const CHEST_CONFIG: Record<ChestType, ChestLootConfig> = {
	regular: {
		gold: { min: 5, max: 25 },
		itemCount: { min: 1, max: 2 },
		rarityWeights: { common: 55, uncommon: 28, rare: 14, epic: 3, unique: 0 },
	},
	rare: {
		gold: { min: 15, max: 50 },
		itemCount: { min: 1, max: 3 },
		rarityWeights: { common: 20, uncommon: 30, rare: 35, epic: 12, unique: 3 },
	},
};

/**
 * Generate loot for a chest when it is first opened.
 * Item selection draws from the full item pool; rarity scales with floor depth.
 * The returned LootDrop lives only in pendingInteraction — it is never written to lootByIdx.
 */
export function rollChestLoot(
	chestType: ChestType,
	floorDepth: number,
	rng: () => number,
	itemsById: Record<string, ItemDef>,
	affixesById: Record<string, AffixDef>,
): LootDrop {
	const config = CHEST_CONFIG[chestType];
	const drop: LootDrop = { items: [] };

	drop.gold = randomInt(config.gold.min, config.gold.max, rng);

	const itemPool = Object.entries(itemsById);
	if (itemPool.length > 0) {
		const count = randomInt(config.itemCount.min, config.itemCount.max, rng);
		const affixPool = Object.values(affixesById);
		for (let i = 0; i < count; i++) {
			const [baseItemId, baseDef] = itemPool[Math.floor(rng() * itemPool.length)]!;
			const rarity = rollRarity(config.rarityWeights, floorDepth, rng);
			const instance = generateItemInstance(baseItemId, baseDef, rarity, rng, affixPool);
			drop.items.push(instance);
		}
	}

	return drop;
}
