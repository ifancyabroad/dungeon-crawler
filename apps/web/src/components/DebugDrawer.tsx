import { useState } from "react";
import { Button } from "./Button";
import { Input } from "./Input";
import { useCreateGame } from "../features/game/useGames";
import { useGameStore } from "../features/game/gameStore";
import { useMapStore } from "../features/map/mapStore";
import { useErrorStore } from "../features/error/errorStore";
import { getApiErrorMessage } from "../lib/errors";

type DebugDrawerProps = {
	open: boolean;
	onClose: () => void;
};

export default function DebugDrawer({ open, onClose }: DebugDrawerProps) {
	const [seedInput, setSeedInput] = useState("");
	const createGame = useCreateGame();
	const storeGameId = useGameStore((s) => s.storeGameId);
	const setStateFromServer = useGameStore((s) => s.setStateFromServer);
	const restartMainScene = useMapStore((s) => s.restartMainScene);
	const showError = useErrorStore((s) => s.showError);

	async function handleGenerateMap() {
		const raw = seedInput.trim();
		let seed: number | undefined = undefined;
		if (raw !== "") {
			const n = parseInt(raw, 10);
			if (Number.isNaN(n) || n < 1) {
				showError("Seed must be a positive integer or leave empty for random.");
				return;
			}
			seed = n;
		}
		try {
			const data = await createGame.mutateAsync({
				classId: "warrior",
				heroName: "Debug Hero",
				...(seed !== undefined ? { seed } : {}),
			});
			setStateFromServer({
				gameId: data.gameId,
				turn: data.state.turn,
				state: data.state,
			});
			storeGameId(data.gameId);
			restartMainScene();
			onClose();
		} catch (e) {
			showError(getApiErrorMessage(e));
		}
	}

	if (!open) return null;

	return (
		<>
			<div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} aria-hidden />
			<aside
				className={[
					"fixed top-0 right-0 bottom-0 z-50 w-[260px]",
					"bg-bg-surface border-l border-border overflow-y-auto",
					"transform transition-transform duration-200",
				].join(" ")}
				aria-label="Debug drawer"
			>
				<div className="sticky top-0 z-10 border-b border-border bg-bg-surface/95 backdrop-blur">
					<div className="flex items-center justify-between px-4 py-3">
						<h2 className="text-sm font-semibold text-text">Debug</h2>
						<Button
							variant="ghost"
							size="sm"
							onClick={onClose}
							aria-label="Close drawer"
							className="p-1.5"
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
				</div>
				<div className="p-4 space-y-4">
					<div>
						<Input
							label="Seed"
							type="number"
							min={1}
							placeholder="Random if empty"
							value={seedInput}
							onChange={(e) => setSeedInput(e.target.value)}
						/>
						<Button
							variant="ghost"
							size="sm"
							onClick={() =>
								setSeedInput(String(Math.floor(Math.random() * 2147483647)))
							}
							className="mt-1.5"
						>
							Randomize seed
						</Button>
					</div>
					<Button
						variant="primary"
						size="md"
						onClick={handleGenerateMap}
						disabled={createGame.isPending}
						className="w-full"
					>
						{createGame.isPending ? "Creating…" : "Generate map"}
					</Button>
				</div>
			</aside>
		</>
	);
}
