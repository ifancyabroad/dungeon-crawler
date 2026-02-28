import { useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { useContinueGame, useCreateGame } from "../features/games/useGames";
import { useGameStore } from "../stores/gameStore";

export default function Landing() {
	const navigate = useNavigate();
	const storeGameId = useGameStore((s) => s.storeGameId);

	const createGame = useCreateGame();
	const continueGame = useContinueGame();

	const loading = createGame.isPending || continueGame.isPending;

	let error: string | null = null;
	if (createGame.error != null) {
		error =
			createGame.error instanceof Error ? createGame.error.message : "Failed to create game";
	} else if (continueGame.error != null) {
		const err = continueGame.error as { response?: { status?: number }; message?: string };
		error =
			err.response?.status === 401
				? "No game to continue"
				: (err.message ?? "Failed to load game");
	}

	async function handleNewGame() {
		try {
			const data = await createGame.mutateAsync();
			storeGameId(data.gameId);
			navigate("/game");
		} catch {
			// Error surfaced via createGame.error
		}
	}

	async function handleContinue() {
		try {
			const data = await continueGame.mutateAsync();
			storeGameId(data.gameId);
			navigate("/game");
		} catch {
			// Error surfaced via continueGame.error
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
					{error != null && <p className="text-error text-sm mt-1">{error}</p>}
				</div>
			</Card>
		</div>
	);
}
