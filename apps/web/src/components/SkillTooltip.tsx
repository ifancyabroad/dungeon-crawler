import type { ActiveSkillDefinition } from "@app/shared";
import { rankRoman } from "../lib/rankRoman";
import { formatActiveEffectsAtRank } from "../lib/formatActiveSkillEffects";

type SkillTooltipProps = {
	def: ActiveSkillDefinition;
	rank: number;
	cooldownRemaining: number;
	floorUsesRemaining?: number;
	armorLocked: boolean;
};

export function SkillTooltip({
	def,
	rank,
	cooldownRemaining,
	floorUsesRemaining,
	armorLocked,
}: SkillTooltipProps) {
	const effects = formatActiveEffectsAtRank(def, rank);
	const rankGlyph = rankRoman(rank);

	return (
		<div className="px-2 py-2 space-y-1.5">
			{/* Header: name + rank */}
			<div className="flex items-center justify-between gap-2">
				<span className="text-primary uppercase tracking-wide font-mono leading-none">
					{def.name}
				</span>
				<span className="text-primary font-mono leading-none shrink-0">{rankGlyph}</span>
			</div>

			{/* Description */}
			<p className="text-text-muted leading-snug">{def.description}</p>

			{/* Divider */}
			<div className="border-t border-border" />

			{/* Effects */}
			<ul className="space-y-0.5">
				{effects.map((line, i) => (
					<li key={i} className="flex gap-1">
						<span className="text-text-label shrink-0">•</span>
						<span className="text-text">{line}</span>
					</li>
				))}
			</ul>

			{/* Divider */}
			<div className="border-t border-border" />

			{/* Footer: cooldown + range */}
			<dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
				<dt className="text-text-label">Cooldown</dt>
				<dd className="text-text">{def.cooldown > 0 ? `${def.cooldown} turns` : "None"}</dd>
				{def.maxUsesPerFloor != null && (
					<>
						<dt className="text-text-label">Uses/floor</dt>
						<dd className="text-text">{def.maxUsesPerFloor}</dd>
					</>
				)}
				{def.targetType !== "none" && def.range != null && (
					<>
						<dt className="text-text-label">Range</dt>
						<dd className="text-text">{def.range} tiles</dd>
					</>
				)}
			</dl>

			{/* Status badge */}
			{armorLocked ? (
				<p className="text-error">Requires armor proficiency</p>
			) : cooldownRemaining > 0 ? (
				<p className="text-primary-dim">
					{cooldownRemaining} turn{cooldownRemaining !== 1 ? "s" : ""} remaining
				</p>
			) : floorUsesRemaining === 0 ? (
				<p className="text-text-muted">Used this floor — resets on descent</p>
			) : (
				<p className="text-secondary">Ready</p>
			)}
		</div>
	);
}
