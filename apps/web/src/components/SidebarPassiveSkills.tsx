import { skillsById, type PassiveSkillDefinition } from "@app/content";
import type { ActorSkillState } from "@app/shared";
import { rankRoman } from "../lib/rankRoman";
import { SkillIcon } from "./SkillIcon";
import { Tooltip } from "./Tooltip";
import { PassiveSkillTooltip } from "./PassiveSkillTooltip";

type SidebarPassiveSkillsProps = {
	skills: Record<string, ActorSkillState>;
};

export function SidebarPassiveSkills({ skills }: SidebarPassiveSkillsProps) {
	const passiveEntries = Object.entries(skills).flatMap(([skillId, skillState]) => {
		const def = skillsById[skillId as keyof typeof skillsById];
		if (def?.skillType !== "passive") return [];
		return [{ skillId, skillState, passive: def as PassiveSkillDefinition }];
	});

	if (passiveEntries.length === 0) return null;

	return (
		<div
			className="flex flex-wrap gap-1 pt-2 border-t border-border"
			role="region"
			aria-label="Passive skills"
		>
			{passiveEntries.map(({ skillId, skillState, passive }) => {
				const rankGlyph = rankRoman(skillState.rank);
				return (
					<Tooltip
						key={skillId}
						side="top"
						content={<PassiveSkillTooltip def={passive} rank={skillState.rank} />}
					>
						<div
							className="relative flex-none w-10 h-10 border border-border cursor-default"
							aria-label={`${passive.name} ${rankGlyph}`}
						>
							<SkillIcon
								def={passive}
								size={32}
								className="absolute inset-0 m-auto"
							/>
							<span
								aria-hidden
								className="pointer-events-none absolute top-0 right-0 px-0.5 text-primary text-xs leading-none bg-bg-base/80"
							>
								{rankGlyph}
							</span>
						</div>
					</Tooltip>
				);
			})}
		</div>
	);
}
