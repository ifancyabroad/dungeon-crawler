/**
 * Passive skills strip for the sidebar — framed like the skill hotbar (border, typography)
 * but shows mechanical effect lines at the current rank instead of the flavour description.
 */

import { skillsById, type PassiveSkillDefinition } from "@app/content";
import type { ActorSkillState } from "@app/shared";
import { Info } from "lucide-react";
import { formatPassiveEffectsAtRank } from "../lib/formatPassiveSkillEffects";

type SidebarPassiveSkillsProps = {
	skills: Record<string, ActorSkillState>;
};

const RANK_ROMAN = ["I", "II", "III"] as const;

function rankRoman(rank: number): string {
	const i = Math.max(0, Math.min(2, rank - 1));
	return RANK_ROMAN[i];
}

export function SidebarPassiveSkills({ skills }: SidebarPassiveSkillsProps) {
	const passiveEntries = Object.entries(skills).flatMap(([skillId, skillState]) => {
		const def = skillsById[skillId as keyof typeof skillsById];
		if (def?.skillType !== "passive") return [];
		return [{ skillId, skillState, passive: def as PassiveSkillDefinition }];
	});

	if (passiveEntries.length === 0) return null;

	return (
		<div
			className="border-t border-border pt-2 space-y-2"
			role="region"
			aria-label="Passive skills"
		>
			<p className="text-text-label uppercase tracking-wider">Passive skills</p>
			<ul className="space-y-2">
				{passiveEntries.map(({ skillId, skillState, passive }) => {
					const effectLines = formatPassiveEffectsAtRank(passive, skillState.rank);
					const rankGlyph = rankRoman(skillState.rank);

					return (
						<li
							key={skillId}
							className="flex cursor-default flex-col gap-1 border border-border px-2 py-2 text-base leading-snug"
						>
							<div className="flex items-start gap-2">
								<span
									className="shrink-0 cursor-pointer self-start text-text-muted transition-colors hover:text-text-bright"
									data-skill-info
									aria-label="Skill details"
								>
									<Info className="block" size={16} aria-hidden />
								</span>
								<p className="min-w-0 flex-1 wrap-break-word font-mono leading-tight">
									<span className="text-text-bright">{passive.name}</span>
									<span className="text-primary"> {rankGlyph}</span>
								</p>
							</div>
							<ul className="m-0 w-full list-none space-y-0.5 p-0 text-success">
								{effectLines.map((line, i) => (
									<li
										key={`${skillId}-${i}`}
										className="block w-full wrap-break-word"
									>
										{line}
									</li>
								))}
							</ul>
						</li>
					);
				})}
			</ul>
		</div>
	);
}
