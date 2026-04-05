import type { ActiveSkillDefinition, PassiveSkillDefinition } from "@app/shared";
import { rankRoman } from "../lib/rankRoman";
import { SkillIcon } from "./SkillIcon";
import { SkillTooltip } from "./SkillTooltip";
import { PassiveSkillTooltip } from "./PassiveSkillTooltip";
import { Tooltip } from "./Tooltip";

type SkillOfferCardProps = {
	def: ActiveSkillDefinition | PassiveSkillDefinition;
	rank: number;
	isUpgrade: boolean;
	onClick: () => void;
};

export function SkillOfferCard({ def, rank, isUpgrade, onClick }: SkillOfferCardProps) {
	const isPassive = def.skillType === "passive";

	const tooltipContent = isPassive ? (
		<PassiveSkillTooltip def={def as PassiveSkillDefinition} rank={rank} />
	) : (
		<SkillTooltip
			def={def as ActiveSkillDefinition}
			rank={rank}
			cooldownRemaining={0}
			armorLocked={false}
		/>
	);

	return (
		<Tooltip content={tooltipContent} side="right">
			<button
				onClick={onClick}
				className={[
					"w-full text-left px-3 py-2 border transition-colors",
					"border-border hover:border-border-bright hover:bg-bg-elevated",
					"focus:outline-none focus:ring-1 focus:ring-primary",
				].join(" ")}
			>
				<div className="flex items-center gap-3">
					<SkillIcon def={def} size={32} className="shrink-0" />
					<div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
						{/* Row 1: name + rank badge */}
						<div className="flex items-center gap-2 min-w-0">
							<span className="font-mono text-text-bright min-w-0 truncate">
								{def.name}
							</span>
							<span className="shrink-0 text-xs font-mono px-1 border border-primary text-primary uppercase tracking-wide">
								Rank {rankRoman(rank)}
							</span>
						</div>
						{/* Row 2 on mobile, pushed right on desktop */}
						<div className="flex items-center gap-2 sm:ml-auto">
							{isUpgrade && (
								<span className="shrink-0 text-xs font-mono border border-border text-text-muted px-1 uppercase tracking-wide">
									Upgrade
								</span>
							)}
							<span
								className={[
									"shrink-0 text-xs font-mono px-1 border uppercase tracking-wide",
									isPassive
										? "border-skill-passive text-skill-passive"
										: "border-skill-active text-skill-active",
								].join(" ")}
							>
								{isPassive ? "Passive" : "Active"}
							</span>
						</div>
					</div>
				</div>
			</button>
		</Tooltip>
	);
}
