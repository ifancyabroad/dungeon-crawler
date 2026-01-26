import { useState } from "react";
import { useGameStore, GAME_DURATION } from "../stores/gameStore";
import { useCreateScore } from "../features/scores/useScores";

/**
 * Overlay component for game UI controls.
 * Renders different content based on game state:
 * - Idle: Start button
 * - Playing: Timer and score display
 * - Ended: Game over screen with score submission
 */
export default function GameOverlay() {
	const { score, isPlaying, timeLeft, playerName, startGame, resetGame, setPlayerName } =
		useGameStore();
	const createScore = useCreateScore();
	const [submitted, setSubmitted] = useState(false);

	const gameEnded = !isPlaying && score > 0 && !submitted;
	const gameIdle = !isPlaying && (score === 0 || submitted);

	const handleSubmit = () => {
		if (!playerName.trim()) return;
		createScore.mutate(
			{ player: playerName.trim(), points: score },
			{
				onSuccess: () => {
					setSubmitted(true);
				},
			},
		);
	};

	const handlePlayAgain = () => {
		setSubmitted(false);
		resetGame();
	};

	const handleStart = () => {
		setSubmitted(false);
		startGame();
	};

	// Format time as MM:SS
	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	return (
		<div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
			{/* Idle state: Start button */}
			{gameIdle && (
				<button
					onClick={handleStart}
					className="pointer-events-auto rounded bg-white px-6 py-3 text-sm font-medium text-neutral-900 shadow-lg transition-all hover:bg-neutral-100 active:scale-95"
				>
					Start
				</button>
			)}

			{/* Playing state: HUD */}
			{isPlaying && (
				<>
					{/* Timer - top center on mobile, top left on desktop */}
					<div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 md:left-4 md:translate-x-0 rounded bg-black/50 backdrop-blur-sm px-3 py-1.5 text-sm font-medium tabular-nums text-white">
						{formatTime(timeLeft)}
					</div>

					{/* Score - top right */}
					<div className="pointer-events-none absolute right-4 top-4 rounded bg-black/50 backdrop-blur-sm px-3 py-1.5 text-sm font-medium tabular-nums text-white">
						{score.toLocaleString()}
					</div>

					{/* Instructions - bottom center */}
					{timeLeft === GAME_DURATION && (
						<div className="pointer-events-none absolute bottom-6 left-4 right-4 text-center rounded bg-black/50 backdrop-blur-sm px-4 py-2 text-sm text-neutral-300 md:left-auto md:right-auto">
							Click the targets to score
						</div>
					)}
				</>
			)}

			{/* Game ended state: Score submission */}
			{gameEnded && (
				<div className="pointer-events-auto w-full max-w-xs rounded-lg border border-neutral-800 bg-neutral-900/95 backdrop-blur-sm p-6 shadow-xl">
					<div className="text-center mb-5">
						<p className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-1">
							Final Score
						</p>
						<p className="text-3xl font-semibold tabular-nums text-white">
							{score.toLocaleString()}
						</p>
					</div>

					<div className="space-y-3">
						<input
							type="text"
							value={playerName}
							onChange={(e) => setPlayerName(e.target.value)}
							placeholder="Your name"
							maxLength={20}
							className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-neutral-600 focus:outline-none transition-colors"
							onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
						/>

						<button
							onClick={handleSubmit}
							disabled={!playerName.trim() || createScore.isPending}
							className="w-full rounded bg-white px-4 py-2 text-sm font-medium text-neutral-900 transition-all hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{createScore.isPending ? "Saving..." : "Save Score"}
						</button>

						<button
							onClick={handlePlayAgain}
							className="w-full rounded px-4 py-2 text-sm font-medium text-neutral-400 transition-colors hover:text-white hover:bg-neutral-800"
						>
							Try Again
						</button>
					</div>

					{createScore.isError && (
						<p className="mt-3 text-center text-xs text-red-400">
							Could not save score. Please try again.
						</p>
					)}
				</div>
			)}
		</div>
	);
}
