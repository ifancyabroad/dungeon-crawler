import { Backpack, Sparkles, User } from "lucide-react";
import { getHero, XP_PER_LEVEL } from "@app/shared";
import { classesById, skillsById, type CharacterClassId } from "@app/content";
import { useGameStore } from "../features/game/gameStore";
import { useUiStore } from "../features/ui/uiStore";
import { Button } from "./Button";

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
		<div className="h-4 bg-[#1a1a1a] overflow-hidden">
			<div className={`h-full transition-all ${colorClass}`} style={{ width: `${pct}%` }} />
		</div>
	);
}

export default function Sidebar({ open, onClose }: SidebarProps) {
	const state = useGameStore((s) => s.state);
	const hero = state ? getHero(state) : undefined;
	const classDef =
		hero?.def.type === "hero" ? classesById[hero.def.classId as CharacterClassId] : undefined;
	const xpForNext = hero ? XP_PER_LEVEL[hero.level + 1] : undefined;

	const hpPct = hero ? Math.max(0, Math.min(100, (hero.hp / hero.maxHp) * 100)) : 0;
	const xpPct =
		hero && xpForNext && xpForNext > 0
			? Math.max(0, Math.min(100, (hero.xp / xpForNext) * 100))
			: 0;

	const openModal = useUiStore((s) => s.open);

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
					// On mobile the sidebar is an overlay panel; on desktop it sits flush beside the canvas.
					"bg-bg-panel border-r-2 border-border md:bg-transparent md:border-0",
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
						{/* Icon buttons */}
						<div className="flex gap-1">
							<Button
								variant="secondary"
								size="icon"
								aria-label="Character Sheet"
								onClick={() => openModal("characterSheet")}
							>
								<User className="w-4 h-4" />
							</Button>
							<Button
								variant="secondary"
								size="icon"
								aria-label="Inventory"
								onClick={() => openModal("inventory")}
							>
								<Backpack className="w-4 h-4" />
							</Button>
							<Button
								variant="secondary"
								size="icon"
								aria-label="Skills"
								onClick={() => openModal("skills")}
							>
								<Sparkles className="w-4 h-4" />
							</Button>
						</div>

						{/* Hero identity */}
						<div className="border-b border-border pb-2">
							<p className="text-primary uppercase tracking-widest">
								{hero.name}
								{!hero.alive && (
									<span className="text-death ml-1.5 font-normal normal-case tracking-normal">
										(Deceased)
									</span>
								)}
							</p>
							<p className="text-text-label">
								Level {hero.level}{" "}
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

						{/* AC / Gold */}
						<div className="grid grid-cols-2 gap-y-0.5">
							<div className="flex gap-1">
								<span className="text-text-label w-7 shrink-0">AC</span>
								<span className="text-text tabular-nums">{hero.armorClass}</span>
							</div>
							<div className="flex gap-1">
								<span className="text-text-label w-10 shrink-0">Gold</span>
								<span className="text-text tabular-nums">0</span>
							</div>
						</div>

						{/* Passive skills */}
						{(() => {
							const passiveSkillIds = Object.keys(hero.skills).filter((id) => {
								const def = skillsById[id as keyof typeof skillsById];
								return def?.skillType === "passive";
							});
							if (passiveSkillIds.length === 0) return null;
							return (
								<div className="border-t border-border pt-2 space-y-1">
									<p className="text-text-label uppercase tracking-wider">
										Passive Skills
									</p>
									{passiveSkillIds.map((id) => {
										const def = skillsById[id as keyof typeof skillsById];
										if (!def) return null;
										return (
											<div
												key={id}
												className="flex flex-col gap-0.5"
												title={def.description}
											>
												<span className="text-secondary font-mono">
													{def.name}
												</span>
												<span className="text-text-muted leading-tight">
													{def.description}
												</span>
											</div>
										);
									})}
								</div>
							);
						})()}
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
