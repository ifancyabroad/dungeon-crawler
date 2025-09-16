import { useState } from "react";
import GameCanvas from "./components/GameCanvas";
import Sidebar from "./components/Sidebar";

export default function App() {
	const [open, setOpen] = useState(false);

	return (
		<div className="h-screen w-screen bg-slate-950 text-slate-100">
			<div className="flex h-full">
				<Sidebar open={open} onClose={() => setOpen(false)} />

				<div className="relative flex-1 h-full">
					<GameCanvas className="h-full w-full" />

					<button
						onClick={() => setOpen(true)}
						className="md:hidden absolute top-3 left-3 rounded-lg bg-slate-800/80 px-3 py-2 text-sm text-slate-100 backdrop-blur hover:bg-slate-700/80"
						aria-label="Open sidebar"
					>
						☰ Menu
					</button>
				</div>
			</div>
		</div>
	);
}
