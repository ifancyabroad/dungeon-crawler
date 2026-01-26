import { useState } from "react";
import Sidebar from "../components/Sidebar";
import GameCanvas from "../components/GameCanvas";
import GameOverlay from "../components/GameOverlay";

export default function Game() {
	const [open, setOpen] = useState(false);

	return (
		<div className="h-screen w-screen bg-neutral-950 text-neutral-100">
			<div className="flex h-full">
				<Sidebar open={open} onClose={() => setOpen(false)} />

				<div className="relative flex-1 h-full">
					<div className="h-full">
						<GameCanvas />
					</div>

					{/* Game UI overlay */}
					<GameOverlay />

					<button
						onClick={() => setOpen(true)}
						className="md:hidden absolute top-3 left-3 bg-neutral-800/80 px-3 py-2 text-sm text-neutral-100 backdrop-blur hover:bg-neutral-700/80"
						aria-label="Open sidebar"
					>
						☰ Menu
					</button>
				</div>
			</div>
		</div>
	);
}
