import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
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
		<div className="min-h-screen bg-bg-base flex items-center justify-center p-4">
			<Card title="Dungeon Crawler" className="w-full max-w-sm">
				<div className="flex flex-col gap-3">
					<Button
						variant="primary"
						size="lg"
						onClick={handleNewGame}
						disabled={continueGame.isPending}
					>
						New Game
					</Button>
					<Button
						variant="secondary"
						size="lg"
						onClick={() => handleContinue()}
						disabled={!canContinue || continueGame.isPending}
					>
						{continueGame.isPending ? "Loading…" : "Continue"}
					</Button>
				</div>
			</Card>

			<Modal
				open={warnOpen}
				onClose={() => setWarnOpen(false)}
				title="Existing Game"
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
				<p className="text-text-muted">
					You have an active game. Starting a new one will end your current adventure.
				</p>
			</Modal>
		</div>
	);
}
