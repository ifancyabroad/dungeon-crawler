import { skillsById } from "@app/content";
import type { ActiveSkillDefinition, PassiveSkillDefinition } from "@app/shared";
import { getHero } from "@app/shared";
import { useGameStore } from "../features/game/gameStore";
import { useUiStore } from "../features/ui/uiStore";
import { rankRoman } from "../lib/rankRoman";
import { Modal } from "./Modal";
import { SkillIcon } from "./SkillIcon";
import { SkillTooltip } from "./SkillTooltip";
import { PassiveSkillTooltip } from "./PassiveSkillTooltip";
import { Tooltip } from "./Tooltip";

type SkillRowProps = {
	def: ActiveSkillDefinition | PassiveSkillDefinition;
	rank: number;
	cooldownRemaining?: number;
	armorLocked?: boolean;
};

function SkillRow({ def, rank, cooldownRemaining = 0, armorLocked = false }: SkillRowProps) {
	const isPassive = def.skillType === "passive";

	const tooltipContent = isPassive ? (
		<PassiveSkillTooltip def={def as PassiveSkillDefinition} rank={rank} />
	) : (
		<SkillTooltip
			def={def as ActiveSkillDefinition}
			rank={rank}
			cooldownRemaining={cooldownRemaining}
			armorLocked={armorLocked}
		/>
	);

	return (
		<Tooltip content={tooltipContent} side="right">
			<div className="flex items-center gap-3 px-3 py-2 border border-border hover:border-border-bright hover:bg-bg-elevated transition-colors cursor-default">
				<SkillIcon def={def} size={32} className="shrink-0" />
				<span className="flex-1 font-mono text-text-bright truncate">{def.name}</span>
				<span className="shrink-0 text-xs font-mono px-1 border border-primary text-primary uppercase tracking-wide">
					Rank {rankRoman(rank)}
				</span>
			</div>
		</Tooltip>
	);
}

export function SkillsModal() {
	const openModal = useUiStore((s) => s.openModal);
	const close = useUiStore((s) => s.close);
	const state = useGameStore((s) => s.state);

	const heroActor = state ? getHero(state) : undefined;
	const heroSkills = heroActor?.skills ?? {};
	const armorLocked = heroActor ? !heroActor.armorProficient : false;

	const activeSkills: { def: ActiveSkillDefinition; rank: number; skillId: string }[] = [];
	const passiveSkills: { def: PassiveSkillDefinition; rank: number; skillId: string }[] = [];

	for (const [skillId, entry] of Object.entries(heroSkills)) {
		const def = skillsById[skillId as keyof typeof skillsById];
		if (!def || !entry) continue;
		if (def.skillType === "active") {
			activeSkills.push({ def: def as ActiveSkillDefinition, rank: entry.rank, skillId });
		} else if (def.skillType === "passive") {
			passiveSkills.push({ def: def as PassiveSkillDefinition, rank: entry.rank, skillId });
		}
	}

	return (
		<Modal open={openModal === "skills"} onClose={close} title="Skills">
			{!heroActor ? (
				<p className="text-text-muted italic font-mono">No active game.</p>
			) : activeSkills.length === 0 && passiveSkills.length === 0 ? (
				<p className="text-text-muted italic font-mono">No skills learned yet.</p>
			) : (
				<div className="space-y-4">
					{/* Active section */}
					{activeSkills.length > 0 && (
						<div className="space-y-1">
							<h3 className="font-mono uppercase tracking-wide text-skill-active mb-2">
								Active ({activeSkills.length})
							</h3>
							{activeSkills.map(({ def, rank, skillId }) => (
								<SkillRow
									key={skillId}
									def={def}
									rank={rank}
									cooldownRemaining={heroSkills[skillId]?.cooldownRemaining ?? 0}
									armorLocked={armorLocked}
								/>
							))}
						</div>
					)}

					{/* Passive section */}
					{passiveSkills.length > 0 && (
						<div className="space-y-1">
							<h3 className="font-mono uppercase tracking-wide text-skill-passive mb-2">
								Passive ({passiveSkills.length})
							</h3>
							{passiveSkills.map(({ def, rank, skillId }) => (
								<SkillRow key={skillId} def={def} rank={rank} />
							))}
						</div>
					)}
				</div>
			)}
		</Modal>
	);
}
