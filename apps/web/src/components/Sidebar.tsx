import { getHero } from "@app/shared";
import { classesById, type CharacterClassId } from "@app/content";
import { Button } from "./Button";
import { TileSprite } from "./TileSprite";
import { useGameStore } from "../features/game/gameStore";
import { getHeroTile } from "../game/tiles/tilesetRegistry";

type SidebarProps = {
	open: boolean;
	onClose: () => void;
};

export default function Sidebar({ open, onClose }: SidebarProps) {
	const state = useGameStore((s) => s.state);
	const hero = state ? getHero(state) : undefined;
	const classDef =
		hero?.def.type === "hero" ? classesById[hero.def.classId as CharacterClassId] : undefined;

	return (
		<>
			<div
				onClick={onClose}
				className={`fixed inset-0 z-40 bg-black/50 md:hidden ${open ? "block" : "hidden"}`}
			/>

			<aside
				className={[
					"fixed md:static inset-y-0 left-0 z-50 md:z-0",
					"w-80 max-w-full bg-bg-base border-r border-border",
					"overflow-y-auto",
					"transform transition-transform duration-200",
					open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
				].join(" ")}
			>
				<div className="px-5 py-4 space-y-4">
					{hero ? (
						<>
							<div className="flex items-center gap-3">
								<TileSprite
									tileIndex={getHeroTile(
										hero.def.type === "hero" ? hero.def.classId : "warrior",
									)}
									size={48}
								/>
								<div className="flex-1 min-w-0">
									<p className="text-sm font-semibold text-text">{hero.name}</p>
									<p className="text-xs text-text-muted">
										{classDef?.name ?? "Unknown"}
									</p>
								</div>
								<Button
									variant="ghost"
									size="sm"
									onClick={onClose}
									aria-label="Close sidebar"
									className="md:hidden p-1.5 shrink-0"
								>
									<svg
										className="w-4 h-4"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M6 18L18 6M6 6l12 12"
										/>
									</svg>
								</Button>
							</div>
							<div className="space-y-1">
								<div className="flex justify-between text-xs">
									<span className="text-text-muted">HP</span>
									<span className="text-text tabular-nums">
										{hero.hp} / {hero.maxHp}
									</span>
								</div>
								<div className="h-1.5 rounded-full bg-bg-elevated overflow-hidden">
									<div
										className="h-full rounded-full bg-success transition-all"
										style={{
											width: `${Math.max(0, Math.min(100, (hero.hp / hero.maxHp) * 100))}%`,
										}}
									/>
								</div>
							</div>
						</>
					) : (
						<div className="flex items-center justify-between">
							<p className="text-sm text-text-muted">No hero data available.</p>
							<Button
								variant="ghost"
								size="sm"
								onClick={onClose}
								aria-label="Close sidebar"
								className="md:hidden p-1.5 shrink-0"
							>
								<svg
									className="w-4 h-4"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M6 18L18 6M6 6l12 12"
									/>
								</svg>
							</Button>
						</div>
					)}
				</div>
			</aside>
		</>
	);
}
