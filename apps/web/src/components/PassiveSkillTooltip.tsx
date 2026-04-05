import type { PassiveSkillDefinition } from "@app/content";
import { rankRoman } from "../lib/rankRoman";
import { formatPassiveEffectsAtRank } from "../lib/formatPassiveSkillEffects";

type PassiveSkillTooltipProps = {
	def: PassiveSkillDefinition;
	rank: number;
};

export function PassiveSkillTooltip({ def, rank }: PassiveSkillTooltipProps) {
	const effects = formatPassiveEffectsAtRank(def, rank);
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
						<span className="text-success">{line}</span>
					</li>
				))}
			</ul>
		</div>
	);
}
