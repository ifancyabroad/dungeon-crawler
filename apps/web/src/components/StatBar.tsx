type StatBarColor = "hp" | "xp" | "primary";

type StatBarProps = {
	label: string;
	current: number;
	max: number | undefined;
	color?: StatBarColor;
	showNumbers?: boolean;
	inline?: boolean;
};

const barColorClasses: Record<StatBarColor, string> = {
	hp: "bg-hp",
	xp: "bg-xp",
	primary: "bg-primary",
};

export function StatBar({
	label,
	current,
	max,
	color = "primary",
	showNumbers = true,
	inline = false,
}: StatBarProps) {
	const pct =
		max !== undefined && max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 100;

	const numbers = max !== undefined ? `${current}/${max}` : `${current}`;

	if (inline) {
		return (
			<div className="flex items-center gap-1.5">
				<span className="text-text-label w-6 shrink-0">{label}</span>
				<span className="tabular-nums text-text w-16 shrink-0 text-right">
					{showNumbers ? numbers : ""}
				</span>
				<div className="flex-1 h-3 bg-bg-elevated overflow-hidden">
					<div
						className={`h-full transition-all ${barColorClasses[color]}`}
						style={{ width: `${pct}%` }}
					/>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-1">
			<div className="flex justify-between">
				<span className="text-text-label">{label}</span>
				{showNumbers && <span className="tabular-nums text-text">{numbers}</span>}
			</div>
			<div className="h-4 bg-bg-elevated overflow-hidden">
				<div
					className={`h-full transition-all ${barColorClasses[color]}`}
					style={{ width: `${pct}%` }}
				/>
			</div>
		</div>
	);
}
