import { useState } from "react";
import Sidebar from "../components/Sidebar";
import GameCanvas from "../components/GameCanvas";
import GameOverlay from "../components/GameOverlay";
import { Button } from "../components/Button";

export default function Game() {
	const [open, setOpen] = useState(false);

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
