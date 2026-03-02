import { useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { useContinueGame, useCreateGame } from "../features/game/useGames";
import { useGameStore } from "../features/game/gameStore";
import { useErrorStore } from "../features/error/errorStore";
import { getApiErrorMessage } from "../lib/errors";

export default function Landing() {
	const navigate = useNavigate();
	const setState = useGameStore((s) => s.setState);
	const storeGameId = useGameStore((s) => s.storeGameId);
	const showError = useErrorStore((s) => s.showError);

	const createGame = useCreateGame();
	const continueGame = useContinueGame();

	const loading = createGame.isPending || continueGame.isPending;

	async function handleNewGame() {
		try {
			const data = await createGame.mutateAsync();
			setState({ gameId: data.gameId, turn: data.state.turn, state: data.state });
			storeGameId(data.gameId);
			navigate("/game");
		} catch (e) {
			showError(getApiErrorMessage(e));
		}
	}

	async function handleContinue() {
		try {
			const data = await continueGame.mutateAsync();
			setState({ gameId: data.gameId, turn: data.state.turn, state: data.state });
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
						onClick={() => handleNewGame()}
						disabled={loading}
					>
						{createGame.isPending ? "Creating…" : "New Game"}
					</Button>
					<Button
						variant="secondary"
						size="lg"
						onClick={() => handleContinue()}
						disabled={loading}
					>
						{continueGame.isPending ? "Loading…" : "Continue"}
					</Button>
				</div>
			</Card>
		</div>
	);
}
