import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { useContinueGame, useGameStatus } from "../features/game/useGames";
import { useGameStore } from "../features/game/gameStore";
import { useErrorStore } from "../features/error/errorStore";
import { getApiErrorMessage } from "../lib/errors";

export default function Landing() {
	const navigate = useNavigate();
	const setStateFromServer = useGameStore((s) => s.setStateFromServer);
	const storeGameId = useGameStore((s) => s.storeGameId);
	const getStoredGameId = useGameStore((s) => s.getStoredGameId);
	const showError = useErrorStore((s) => s.showError);

	const continueGame = useContinueGame();
	const gameStatus = useGameStatus();
	const [warnOpen, setWarnOpen] = useState(false);

	const hasActiveHero = gameStatus.data?.hasActiveHero ?? false;
	const canContinue = hasActiveHero && !gameStatus.isLoading;

	function handleNewGame() {
		const existingId = getStoredGameId();
		if (existingId && hasActiveHero) {
			setWarnOpen(true);
		} else {
			navigate("/character-create");
		}
	}

	async function handleContinue() {
		try {
			const data = await continueGame.mutateAsync();
			setStateFromServer({ gameId: data.gameId, turn: data.state.turn, state: data.state });
			storeGameId(data.gameId);
			navigate("/game");
		} catch (e) {
			showError(getApiErrorMessage(e));
		}
	}

	return (
		<div className="min-h-screen bg-bg-base flex flex-col items-center justify-center p-4">
			{/* DCSS-style panel: amber border, warm dark background */}
			<div className="border-2 border-border bg-bg-panel px-12 py-10 flex flex-col items-center">
				{/* Title */}
				<h1 className="text-primary text-4xl mb-6 tracking-wide">Dungeon Crawler</h1>

				{/* Flavor text */}
				<div className="text-center mb-6 space-y-1">
					<p className="text-text">Descend into the depths of an ancient dungeon.</p>
					<p className="text-text">Battle monsters, gain levels, grow in power.</p>
					<p className="text-text">How far can you go before the darkness takes you?</p>
				</div>

				<div className="w-full border-t-2 border-border mb-6" />

				{/* Menu */}
				<nav className="flex flex-col items-center gap-2 w-full">
					<Button
						variant="primary"
						size="lg"
						onClick={handleNewGame}
						disabled={continueGame.isPending}
						className="w-48"
					>
						New Game
					</Button>
					<Button
						variant="secondary"
						size="lg"
						onClick={() => handleContinue()}
						disabled={!canContinue || continueGame.isPending}
						className="w-48"
					>
						{continueGame.isPending ? "Loading…" : "Continue"}
					</Button>
				</nav>
			</div>

			<Modal
				open={warnOpen}
				onClose={() => setWarnOpen(false)}
				title="Abandon current game?"
				footer={
					<>
						<Button variant="secondary" size="md" onClick={() => setWarnOpen(false)}>
							Cancel
						</Button>
						<Button
							variant="primary"
							size="md"
							onClick={() => {
								setWarnOpen(false);
								navigate("/character-create");
							}}
						>
							Start New
						</Button>
					</>
				}
			>
				<p className="text-base text-text">
					You have an active hero. Starting a new game will end their journey.
				</p>
			</Modal>
		</div>
	);
}
