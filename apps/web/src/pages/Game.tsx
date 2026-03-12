import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import GameCanvas from "../components/GameCanvas";
import { CombatLog } from "../components/CombatLog";
import { DeathModal } from "../components/DeathModal";
import { LevelUpModal } from "../components/LevelUpModal";
import DebugDrawer from "../components/DebugDrawer";
import { useGameSocket } from "../features/game/useGameSocket";
import { useGameStore } from "../features/game/gameStore";

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
						<button
							type="button"
							onClick={() => setSidebarOpen(true)}
							className="md:hidden absolute top-3 left-3 text-sm border border-border bg-bg-panel/95 text-text-muted hover:text-text-bright px-3 py-1 transition-colors"
							aria-label="Open sidebar"
						>
							≡ Menu
						</button>

						{DEBUG_DRAWER_ENABLED && (
							<button
								type="button"
								onClick={() => setDebugDrawerOpen(true)}
								className="absolute top-3 right-3 font-mono text-xs uppercase tracking-wider border border-border bg-bg-panel/90 text-text-muted hover:text-text px-2.5 py-1 transition-colors"
								aria-label="Open debug drawer"
							>
								Debug
							</button>
						)}
					</div>

					<CombatLog />
				</div>
			</div>

			<DeathModal open={!heroAlive && gameId !== null} />
			<LevelUpModal />

			<DebugDrawer open={debugDrawerOpen} onClose={() => setDebugDrawerOpen(false)} />
		</div>
	);
}
