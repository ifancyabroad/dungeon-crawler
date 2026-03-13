import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Modal } from "../components/Modal";
import { Button } from "../components/Button";
import { PanelBox } from "../components/PanelBox";
import { useContinueGame, useGameStatus } from "../features/game/useGames";
import { useGameStore } from "../features/game/gameStore";
import { useErrorStore } from "../features/error/errorStore";
import { getApiErrorMessage } from "../lib/errors";

interface MenuItemProps {
	hotkey: string;
	label: string;
	hint?: string;
	disabled?: boolean;
	onClick?: () => void;
}

function MenuItem({ hotkey, label, hint, disabled, onClick }: MenuItemProps) {
	return (
		<button
			onClick={onClick}
			disabled={disabled}
			className={[
				"group flex items-baseline gap-3 w-full text-left px-3 py-1 transition-colors",
				"hover:bg-bg-elevated",
				"focus:outline-none focus-visible:outline-none focus-visible:bg-bg-elevated",
				"disabled:opacity-30 disabled:pointer-events-none",
			].join(" ")}
		>
			<span className="text-primary font-mono w-6 shrink-0 select-none">[{hotkey}]</span>
			<span className="text-text-bright font-mono tracking-wide uppercase group-hover:text-primary transition-colors">
				{label}
			</span>
			{hint && <span className="text-text-muted font-mono ml-auto">{hint}</span>}
		</button>
	);
}

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
	const isLoading = continueGame.isPending || gameStatus.isLoading;

	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
			if (warnOpen) return;
			if (isLoading) return;

			switch (e.key.toLowerCase()) {
				case "n":
					handleNewGame();
					break;
				case "c":
					if (canContinue) handleContinue();
					break;
			}
		}

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [warnOpen, isLoading, canContinue]);

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
		<>
			<div className="min-h-screen bg-bg-base flex flex-col items-center justify-center p-4 overflow-hidden">
				{/* Version tag */}
				<div className="absolute top-3 right-4 text-text-dim font-mono">v0.1.0-alpha</div>

				{/* Title */}
				<div className="text-center mb-8">
					<h1 className="font-mono text-5xl tracking-widest uppercase text-primary mb-2">
						Dungeon Crawler
					</h1>
					<div className="flex items-center justify-center gap-3 mt-1">
						<span className="text-border font-mono select-none">~*~</span>
						<span className="text-text-label font-mono tracking-widest uppercase">
							A Roguelike Dungeon Adventure
						</span>
						<span className="text-border font-mono select-none">~*~</span>
					</div>
				</div>

				{/* ── Main panel ── */}
				<div className="w-full max-w-md">
					<PanelBox
						title="Main Menu"
						footer={
							<span className="text-text-dim font-mono">
								Use letter keys or click to select
							</span>
						}
					>
						{/* Flavor text */}
						<div className="px-5 pt-4 pb-3 space-y-0.5 border-b border-border">
							<p className="text-text-muted font-mono">
								&gt; You stand at the entrance to an ancient dungeon.
							</p>
							<p className="text-text-muted font-mono">
								&gt; Torchlight flickers. Something stirs below.
							</p>
						</div>

						{/* Menu items */}
						<div className="py-2">
							<MenuItem
								hotkey="n"
								label="New Game"
								onClick={handleNewGame}
								disabled={isLoading}
							/>
							<MenuItem
								hotkey="c"
								label="Continue"
								hint={canContinue ? "" : "(no save found)"}
								onClick={handleContinue}
								disabled={!canContinue || isLoading}
							/>
							<div className="mx-4 my-1 border-t border-border/50" />
							<MenuItem
								hotkey="l"
								label="Leaderboard"
								hint="(coming soon)"
								disabled
							/>
							<MenuItem hotkey="r" label="Register" hint="(coming soon)" disabled />
							<MenuItem hotkey="h" label="Help" hint="(coming soon)" disabled />
						</div>
					</PanelBox>
				</div>

				{/* Flavour line */}
				<div className="mt-5 text-text-dim font-mono text-center">
					<p>May fortune favour the bold.</p>
				</div>
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
		</>
	);
}
