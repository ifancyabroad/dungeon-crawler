import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import GameCanvas from "../components/GameCanvas";
import GameOverlay from "../components/GameOverlay";
import { Button } from "../components/Button";
import { useGameSocket } from "../features/game/useGameSocket";
import { useGameStore } from "../features/game/gameStore";

export default function Game() {
	const navigate = useNavigate();
	const gameId = useGameStore((s) => s.gameId);

	useEffect(() => {
		const stored = useGameStore.getState().getStoredGameId();
		if (stored && !useGameStore.getState().gameId) {
			useGameStore.getState().setGameId(stored);
		}
	}, []);

	useGameSocket(gameId);

	const [open, setOpen] = useState(false);

	useEffect(() => {
		if (typeof window === "undefined") return;
		const stored = useGameStore.getState().getStoredGameId();
		if (gameId === null && stored === null) navigate("/", { replace: true });
	}, [gameId, navigate]);

	return (
		<div className="h-screen w-screen bg-bg-base text-text">
			<div className="flex h-full">
				<Sidebar open={open} onClose={() => setOpen(false)} />

				<div className="relative flex-1 h-full">
					<div className="h-full">
						<GameCanvas />
					</div>

					{/* Game UI overlay */}
					<GameOverlay />

					<Button
						variant="secondary"
						size="md"
						onClick={() => setOpen(true)}
						className="md:hidden absolute top-3 left-3 backdrop-blur bg-bg-surface/80 hover:bg-bg-elevated/80"
						aria-label="Open sidebar"
					>
						☰ Menu
					</Button>
				</div>
			</div>
		</div>
	);
}
