import type { ActiveSkillDefinition, PassiveSkillDefinition } from "@app/shared";
import { skillIconUrl } from "../lib/assets";

type SkillIconProps = {
	def: ActiveSkillDefinition | PassiveSkillDefinition;
	size?: number; // px, default 48
	className?: string;
};

export function SkillIcon({ def, size = 48, className }: SkillIconProps) {
	if (def.icon) {
		return (
			<img
				src={skillIconUrl(def.icon)}
				alt={def.name}
				className={[
					"block shrink-0 object-contain [image-rendering:pixelated]",
					className ?? "",
				].join(" ")}
				style={{ width: size, height: size }}
			/>
		);
	}
	return (
		<div
			aria-hidden
			className={[
				"flex items-center justify-center border border-border bg-bg-elevated",
				"font-mono text-text-muted select-none shrink-0",
				className ?? "",
			].join(" ")}
			style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }}
		>
			{def.name.charAt(0).toUpperCase()}
		</div>
	);
}
