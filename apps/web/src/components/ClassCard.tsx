import type { CharacterClassDefinition } from "@app/content";
import { TileSprite } from "./TileSprite";
import { getHeroTile } from "../game/tiles/tilesetRegistry";

type StatKey = keyof CharacterClassDefinition["baseAttributes"];

const STAT_LABELS: { key: StatKey; label: string }[] = [
	{ key: "strength", label: "STR" },
	{ key: "dexterity", label: "DEX" },
	{ key: "constitution", label: "CON" },
	{ key: "intelligence", label: "INT" },
	{ key: "wisdom", label: "WIS" },
	{ key: "charisma", label: "CHA" },
];

/** Returns the label of the stat with the highest value — the class's defining attribute. */
function getPrimaryStatLabel(attrs: CharacterClassDefinition["baseAttributes"]): string {
	let best = STAT_LABELS[0];
	for (const stat of STAT_LABELS) {
		if (attrs[stat.key] > attrs[best.key]) best = stat;
	}
	return best.label;
}

type ClassCardProps = {
	cls: CharacterClassDefinition;
	selected: boolean;
	onSelect: () => void;
};

export function ClassCard({ cls, selected, onSelect }: ClassCardProps) {
	const keyStatLabel = getPrimaryStatLabel(cls.baseAttributes);

	return (
		<button
			type="button"
			onClick={onSelect}
			className={[
				"group relative flex flex-col text-left p-3 transition-colors focus:outline-none",
				selected ? "bg-bg-elevated" : "bg-bg-panel hover:bg-bg-elevated",
			].join(" ")}
		>
			{/* Sprite + name row */}
			<div className="flex items-center gap-2 mb-2">
				<TileSprite tileIndex={getHeroTile(cls.id)} size={28} />
				<span
					className={[
						"font-mono tracking-widest uppercase transition-colors",
						selected ? "text-primary" : "text-text-bright group-hover:text-primary",
					].join(" ")}
				>
					{cls.name}
				</span>
			</div>

			{/* Description — grows to keep footer pinned */}
			<p className="flex-1 text-text-muted font-mono leading-snug mb-3">{cls.description}</p>

			{/* Footer: key stat */}
			<div className="font-mono">
				<span className="text-text-label uppercase tracking-widest">Key stat </span>
				<span className="text-primary uppercase tracking-widest">{keyStatLabel}</span>
			</div>

			{/* Selected indicator */}
			{selected && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
		</button>
	);
}
