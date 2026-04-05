import type { ActiveEffect } from "@app/shared";
import { skillIconUrl, statusIconUrl } from "../lib/assets";
import { type StatusEffectCategory, getStatusEffectMeta } from "../lib/statusEffectMeta";
import { Tooltip } from "./Tooltip";
import { StatusEffectTooltip } from "./StatusEffectTooltip";

type SidebarStatusEffectsProps = {
	effects: ActiveEffect[];
};

const BORDER_CLASS: Record<StatusEffectCategory, string> = {
	buff: "border-success/60",
	debuff: "border-error/60",
	neutral: "border-border",
};

const BADGE_CLASS: Record<StatusEffectCategory, string> = {
	buff: "text-success",
	debuff: "text-error",
	neutral: "text-text-muted",
};

export function SidebarStatusEffects({ effects }: SidebarStatusEffectsProps) {
	const active = effects.filter((e) => e.remainingTurns > 0);

	return (
		<fieldset className="border border-border px-2 pb-2" role="region">
			<legend className="px-1 text-xs text-text-label uppercase tracking-widest">
				Effects
			</legend>
			<div className="flex flex-wrap gap-1 min-h-10" aria-label="Active effects">
				{active.map((effect) => {
					const meta = getStatusEffectMeta(effect);
					const borderClass = BORDER_CLASS[meta.category];
					const badgeClass = BADGE_CLASS[meta.category];

					const iconSrc = meta.statusIcon
						? statusIconUrl(meta.statusIcon)
						: meta.skillIcon
							? skillIconUrl(meta.skillIcon)
							: null;

					return (
						<Tooltip
							key={effect.id}
							side="top"
							content={<StatusEffectTooltip effect={effect} />}
						>
							<div
								className={`relative flex-none w-10 h-10 border ${borderClass} cursor-default`}
								aria-label={`${meta.name} — ${effect.remainingTurns} turns remaining`}
							>
								{iconSrc ? (
									<img
										src={iconSrc}
										alt=""
										width={32}
										height={32}
										className="absolute inset-0 m-auto [image-rendering:pixelated]"
									/>
								) : (
									<span className="absolute inset-0 flex items-center justify-center text-xs font-mono text-text-muted">
										{meta.name.charAt(0).toUpperCase()}
									</span>
								)}
								<span
									aria-hidden
									className={`pointer-events-none absolute bottom-0 right-0 px-0.5 text-xs leading-none bg-bg-base/80 ${badgeClass}`}
								>
									{effect.remainingTurns}
								</span>
							</div>
						</Tooltip>
					);
				})}
			</div>
		</fieldset>
	);
}
