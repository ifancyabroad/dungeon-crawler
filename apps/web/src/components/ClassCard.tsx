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

function statColor(value: number): string {
	if (value >= 16) return "text-primary";
	if (value >= 12) return "text-text-bright";
	return "text-text";
}

type ClassCardProps = {
	cls: CharacterClassDefinition;
	selected: boolean;
	onSelect: () => void;
};

// Corner glyph style — matches PanelBox corners.
const CORNER: React.CSSProperties = {
	position: "absolute",
	fontFamily: "'IBM VGA', monospace",
	fontSize: "1rem",
	lineHeight: 1,
	pointerEvents: "none",
	userSelect: "none",
	zIndex: 1,
};

export function ClassCard({ cls, selected, onSelect }: ClassCardProps) {
	return (
		<button
			type="button"
			onClick={onSelect}
			className={[
				"relative text-left p-3 border-2 transition-colors",
				selected
					? "border-border-bright bg-bg-elevated"
					: "border-border bg-bg-panel hover:bg-bg-surface",
			].join(" ")}
		>
			{/* Corner glyphs */}
			<span
				style={{
					...CORNER,
					top: -2,
					left: -2,
					color: selected ? "var(--color-border-bright)" : "var(--color-border)",
				}}
			>
				╔
			</span>
			<span
				style={{
					...CORNER,
					top: -2,
					right: -2,
					color: selected ? "var(--color-border-bright)" : "var(--color-border)",
				}}
			>
				╗
			</span>
			<span
				style={{
					...CORNER,
					bottom: -2,
					left: -2,
					color: selected ? "var(--color-border-bright)" : "var(--color-border)",
				}}
			>
				╚
			</span>
			<span
				style={{
					...CORNER,
					bottom: -2,
					right: -2,
					color: selected ? "var(--color-border-bright)" : "var(--color-border)",
				}}
			>
				╝
			</span>

			{/* Sprite + name + HP */}
			<div className="flex items-center gap-2 mb-2">
				<TileSprite tileIndex={getHeroTile(cls.id)} size={32} />
				<div className="flex-1 min-w-0">
					<div className="flex items-baseline justify-between gap-2">
						<span className={`${selected ? "text-primary" : "text-text-bright"}`}>
							{cls.name}
						</span>
						<span className="text-text-label shrink-0">
							HP <span className="text-text tabular-nums">{cls.startingHp}</span>
						</span>
					</div>
				</div>
			</div>

			{/* Description */}
			<p className="text-text mb-3 leading-snug">{cls.description}</p>

			{/* Stats grid */}
			<div className="grid grid-cols-3 gap-x-2 gap-y-0.5">
				{STAT_LABELS.map(({ key, label }) => (
					<div key={key} className="flex justify-between gap-1">
						<span className="text-text-label">{label}</span>
						<span className={`tabular-nums ${statColor(cls.baseAttributes[key])}`}>
							{cls.baseAttributes[key]}
						</span>
					</div>
				))}
			</div>
		</button>
	);
}
