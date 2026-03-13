import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import GameCanvas from "../components/GameCanvas";
import { CombatLog } from "../components/CombatLog";
import { DeathModal } from "../components/DeathModal";
import { LevelUpModal } from "../components/LevelUpModal";
import { CharacterSheetModal } from "../components/CharacterSheetModal";
import { InventoryModal } from "../components/InventoryModal";
import { SkillsModal } from "../components/SkillsModal";
import DebugDrawer from "../components/DebugDrawer";
import { useGameSocket } from "../features/game/useGameSocket";
import { useGameStore } from "../features/game/gameStore";
import { Button } from "../components/Button";

const DEBUG_DRAWER_ENABLED = import.meta.env.VITE_DEBUG_DRAWER_ENABLED === "true";

export default function Game() {
	const navigate = useNavigate();
	const gameId = useGameStore((s) => s.gameId);
	const heroAlive = useGameStore((s) => s.heroAlive);

	useEffect(() => {
		const stored = useGameStore.getState().getStoredGameId();
		const current = useGameStore.getState().gameId;
		if (stored && !current) {
			useGameStore.getState().setGameId(stored);
		} else if (!stored && !current) {
			navigate("/", { replace: true });
		}
	}, [navigate]);

	useGameSocket(gameId);

	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [debugDrawerOpen, setDebugDrawerOpen] = useState(false);

	return (
		<div className="h-screen w-screen bg-bg-base text-text overflow-hidden">
			<div className="flex h-full">
				<Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

				<div className="flex flex-col flex-1 min-w-0 h-full">
					<div className="relative flex-1 min-h-0">
						<div className="h-full">
							<GameCanvas />
						</div>

						{/* Mobile sidebar toggle */}
						<Button
							variant="secondary"
							onClick={() => setSidebarOpen(true)}
							className="md:hidden absolute top-3 left-3"
							aria-label="Open sidebar"
						>
							≡ Menu
						</Button>

						<div className="absolute top-3 right-3 flex items-center gap-2">
							<Button
								variant="secondary"
								onClick={() => navigate("/")}
								aria-label="Return to main menu"
							>
								← Menu
							</Button>

							{DEBUG_DRAWER_ENABLED && (
								<Button
									variant="secondary"
									onClick={() => setDebugDrawerOpen(true)}
									aria-label="Open debug drawer"
								>
									Debug
								</Button>
							)}
						</div>
					</div>

					<CombatLog />
				</div>
			</div>

			<DeathModal open={!heroAlive && gameId !== null} />
			<LevelUpModal />
			<CharacterSheetModal />
			<InventoryModal />
			<SkillsModal />

			<DebugDrawer open={debugDrawerOpen} onClose={() => setDebugDrawerOpen(false)} />
		</div>
	);
}
