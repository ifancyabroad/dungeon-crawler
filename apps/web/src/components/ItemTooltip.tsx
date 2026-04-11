import type { ItemInstance, WeaponItemDef, BodyArmorItemDef } from "@app/shared";
import type { ItemDefinition, AffixDefinition } from "@app/content";
import { formatPassiveSkillEffectLine } from "../lib/formatPassiveSkillEffects";
import { RARITY_TEXT } from "../lib/rarityColors";

type ItemTooltipProps = {
	instance: ItemInstance;
	def: ItemDefinition;
	affixDefs: AffixDefinition[];
};

function titleCase(s: string): string {
	if (!s) return s;
	return s.charAt(0).toUpperCase() + s.slice(1);
}

const WEAPON_PROP_LABEL: Record<string, string> = {
	finesse: "Finesse",
	two_handed: "Two-handed",
	thrown: "Thrown",
	light: "Light",
	ranged: "Ranged",
};

function WeaponStats({ def, instance }: { def: WeaponItemDef; instance: ItemInstance }) {
	const lines: string[] = [];

	lines.push(`${def.damageDice} ${def.damageType}`);

	if (instance.enhancementBonus > 0) {
		lines.push(`+${instance.enhancementBonus} to attack rolls`);
	}

	for (const prop of def.properties) {
		if (prop === "versatile") {
			lines.push(`Versatile (${def.damageDice} / ${def.versatileDice ?? "?"})`);
		} else if (WEAPON_PROP_LABEL[prop]) {
			lines.push(WEAPON_PROP_LABEL[prop]);
		}
	}

	return (
		<>
			{lines.map((line, i) => (
				<li key={i} className="flex gap-1">
					<span className="text-text-label shrink-0">•</span>
					<span className="text-text">{line}</span>
				</li>
			))}
		</>
	);
}

function BodyArmorStats({ def, instance }: { def: BodyArmorItemDef; instance: ItemInstance }) {
	return (
		<>
			<li className="flex gap-1">
				<span className="text-text-label shrink-0">•</span>
				<span className="text-text">Base AC {def.baseAC}</span>
			</li>
			{instance.enhancementBonus > 0 && (
				<li className="flex gap-1">
					<span className="text-text-label shrink-0">•</span>
					<span className="text-text">+{instance.enhancementBonus} AC (enhancement)</span>
				</li>
			)}
			{def.stealthDisadvantage && (
				<li className="flex gap-1">
					<span className="text-text-label shrink-0">•</span>
					<span className="text-text">Disadvantage on Stealth checks</span>
				</li>
			)}
		</>
	);
}

function AffixLines({ affixDefs }: { affixDefs: AffixDefinition[] }) {
	return (
		<>
			{affixDefs.map((affix, i) => (
				<li key={i} className="flex gap-1">
					<span className="text-text-label shrink-0">•</span>
					<span className="text-text">{formatPassiveSkillEffectLine(affix.effect)}</span>
				</li>
			))}
		</>
	);
}

export function ItemTooltip({ instance, def, affixDefs }: ItemTooltipProps) {
	const rarity = instance.rarity;
	const rarityText = RARITY_TEXT[rarity] ?? "text-white";

	// Build bullet list based on item type
	function renderBullets() {
		if (def.type === "weapon") {
			return (
				<>
					<WeaponStats def={def} instance={instance} />
					<AffixLines affixDefs={affixDefs} />
				</>
			);
		}
		if (def.type === "armor" && def.slot === "body") {
			return (
				<>
					<BodyArmorStats def={def} instance={instance} />
					<AffixLines affixDefs={affixDefs} />
				</>
			);
		}
		if (def.type === "armor") {
			// Extremity armor — affix lines only
			return affixDefs.length > 0 ? (
				<AffixLines affixDefs={affixDefs} />
			) : (
				<li className="flex gap-1">
					<span className="text-text-label shrink-0">•</span>
					<span className="text-text-muted">No bonuses</span>
				</li>
			);
		}
		if (def.type === "shield") {
			return (
				<>
					<li className="flex gap-1">
						<span className="text-text-label shrink-0">•</span>
						<span className="text-text">+{def.acBonus} AC</span>
					</li>
					{instance.enhancementBonus > 0 && (
						<li className="flex gap-1">
							<span className="text-text-label shrink-0">•</span>
							<span className="text-text">
								+{instance.enhancementBonus} AC (enhancement)
							</span>
						</li>
					)}
					<AffixLines affixDefs={affixDefs} />
				</>
			);
		}
		if (def.type === "accessory") {
			return (
				<>
					{def.effects.map((effect, i) => (
						<li key={i} className="flex gap-1">
							<span className="text-text-label shrink-0">•</span>
							<span className="text-text">
								{formatPassiveSkillEffectLine(effect)}
							</span>
						</li>
					))}
					<AffixLines affixDefs={affixDefs} />
				</>
			);
		}
		return null;
	}

	// Build footer key-value pairs
	function renderFooter() {
		let typeLabel = "";
		let slotLabel = "";
		let categoryLabel: string | null = null;

		if (def.type === "weapon") {
			typeLabel = "Weapon";
			slotLabel = "Main Hand";
			categoryLabel = titleCase(def.weaponCategory);
		} else if (def.type === "armor" && def.slot === "body") {
			typeLabel = "Armor";
			slotLabel = "Body";
			categoryLabel = titleCase(def.armorCategory);
		} else if (def.type === "armor") {
			typeLabel = "Armor";
			slotLabel = titleCase(def.slot);
		} else if (def.type === "shield") {
			typeLabel = "Shield";
			slotLabel = "Off Hand";
		} else if (def.type === "accessory") {
			typeLabel = "Accessory";
			slotLabel = titleCase(def.slot);
		}

		return (
			<dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
				<dt className="text-text-label">Type</dt>
				<dd className="text-text">{typeLabel}</dd>
				<dt className="text-text-label">Slot</dt>
				<dd className="text-text">{slotLabel}</dd>
				{categoryLabel && (
					<>
						<dt className="text-text-label">Category</dt>
						<dd className="text-text">{categoryLabel}</dd>
					</>
				)}
			</dl>
		);
	}

	return (
		<div className="px-2 py-2 space-y-1.5">
			{/* Header: generated name in rarity color */}
			<span className={`font-mono uppercase tracking-wide leading-none ${rarityText}`}>
				{instance.generatedName}
			</span>

			{/* Flavor text */}
			{def.description && <p className="text-text-muted leading-snug">{def.description}</p>}

			{/* Divider */}
			<div className="border-t border-border" />

			{/* Stat bullets */}
			<ul className="space-y-0.5">{renderBullets()}</ul>

			{/* Divider */}
			<div className="border-t border-border" />

			{/* Footer metadata */}
			{renderFooter()}
		</div>
	);
}
