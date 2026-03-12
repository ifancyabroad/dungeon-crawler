import { getHero, XP_PER_LEVEL } from "@app/shared";
import { classesById, type CharacterClassId } from "@app/content";
import { useGameStore } from "../features/game/gameStore";

type SidebarProps = {
	open: boolean;
	onClose: () => void;
};

const ATTR_LABELS: { key: string; label: string }[] = [
	{ key: "strength", label: "Str" },
	{ key: "dexterity", label: "Dex" },
	{ key: "constitution", label: "Con" },
	{ key: "intelligence", label: "Int" },
	{ key: "wisdom", label: "Wis" },
	{ key: "charisma", label: "Cha" },
];

function attrColor(value: number): string {
	if (value >= 16) return "text-primary";
	if (value >= 12) return "text-text-bright";
	return "text-text";
}

function Bar({ pct, colorClass }: { pct: number; colorClass: string }) {
	return (
		<div className="h-4 bg-bg-elevated overflow-hidden">
			<div className={`h-full transition-all ${colorClass}`} style={{ width: `${pct}%` }} />
		</div>
	);
}

export default function Sidebar({ open, onClose }: SidebarProps) {
	const state = useGameStore((s) => s.state);
	const turn = useGameStore((s) => s.turn);
	const hero = state ? getHero(state) : undefined;
	const classDef =
		hero?.def.type === "hero" ? classesById[hero.def.classId as CharacterClassId] : undefined;
	const floor = state ? state.heroFloorIndex + 1 : undefined;
	const xpForNext = hero ? XP_PER_LEVEL[hero.level + 1] : undefined;

	const hpPct = hero ? Math.max(0, Math.min(100, (hero.hp / hero.maxHp) * 100)) : 0;
	const xpPct =
		hero && xpForNext && xpForNext > 0
			? Math.max(0, Math.min(100, (hero.xp / xpForNext) * 100))
			: 0;

	return (
		<>
			{/* Mobile backdrop */}
			<div
				onClick={onClose}
				className={`fixed inset-0 z-40 bg-black/80 md:hidden ${open ? "block" : "hidden"}`}
			/>

			<aside
				className={[
					"fixed md:static inset-y-0 left-0 z-50 md:z-0",
					"w-64 max-w-full",
					"bg-bg-panel border-r-2 border-border",
					"md:bg-transparent md:border-0",
					"overflow-y-auto flex flex-col",
					"transform transition-transform duration-200",
					open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
				].join(" ")}
			>
				{/* Mobile close */}
				<div className="flex justify-end px-2 py-1 md:hidden">
					<button
						type="button"
						onClick={onClose}
						className="text-text-muted hover:text-text-bright text-xl leading-none"
						aria-label="Close"
					>
						×
					</button>
				</div>

				{hero ? (
					<div className="flex-1 px-3 py-2 space-y-2">
						{/* Hero identity */}
						<div>
							<p className="text-text-bright">{hero.name}</p>
							<p>
								<span className="text-text-label">Level {hero.level} </span>
								<span className="text-text-bright">
									{classDef?.name ?? "Unknown"}
								</span>
							</p>
						</div>

						{/* HP / XP — label+value in col 1, bar in col 2 */}
						<div
							className="grid gap-x-2 gap-y-0.5 items-center"
							style={{ gridTemplateColumns: "5rem 1fr" }}
						>
							<span className="text-text-label">
								HP{" "}
								<span className="text-text tabular-nums">
									{hero.hp}/{hero.maxHp}
								</span>
							</span>
							<Bar pct={hpPct} colorClass="bg-hp" />

							<span className="text-text-label">
								XP{" "}
								<span className="text-text tabular-nums">
									{hero.xp}/{xpForNext ?? "—"}
								</span>
							</span>
							<Bar pct={xpPct} colorClass="bg-xp" />
						</div>

						{/* Attributes — 2 columns */}
						<div className="grid grid-cols-2 gap-y-0.5">
							{ATTR_LABELS.map(({ key, label }) => {
								const value = hero.attributes[key as keyof typeof hero.attributes];
								return (
									<div key={key} className="flex gap-1">
										<span className="text-text-label w-7 shrink-0">
											{label}
										</span>
										<span className={`tabular-nums ${attrColor(value)}`}>
											{value}
										</span>
									</div>
								);
							})}
						</div>

						{/* AC / Floor / Turn */}
						<div className="grid grid-cols-2 gap-y-0.5">
							<div className="flex gap-1">
								<span className="text-text-label w-7 shrink-0">AC</span>
								<span className="text-text tabular-nums">{hero.armorClass}</span>
							</div>
							<div className="flex gap-1">
								<span className="text-text-label w-10 shrink-0">Floor</span>
								<span className="text-text tabular-nums">{floor ?? "—"}</span>
							</div>
							<div className="flex gap-1">
								<span className="text-text-label w-10 shrink-0">Turn</span>
								<span className="text-text tabular-nums">{turn}</span>
							</div>
						</div>
					</div>
				) : (
					<div className="p-3">
						<p className="text-text-muted">No hero data.</p>
					</div>
				)}
			</aside>
		</>
	);
}
