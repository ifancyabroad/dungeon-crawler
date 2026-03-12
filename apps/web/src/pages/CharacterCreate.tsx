import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { classes } from "@app/content";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { ClassCard } from "../components/ClassCard";
import { useCreateGame } from "../features/game/useGames";
import { useGameStore } from "../features/game/gameStore";
import { useErrorStore } from "../features/error/errorStore";
import { getApiErrorMessage } from "../lib/errors";
import { randomHeroName } from "../lib/nameGenerator";

export default function CharacterCreate() {
	const navigate = useNavigate();
	const createGame = useCreateGame();
	const setStateFromServer = useGameStore((s) => s.setStateFromServer);
	const storeGameId = useGameStore((s) => s.storeGameId);
	const showError = useErrorStore((s) => s.showError);

	const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
	const [heroName, setHeroName] = useState("");
	const [nameError, setNameError] = useState("");

	useEffect(() => {
		setHeroName(randomHeroName());
	}, []);

	const selectedClass = classes.find((c) => c.id === selectedClassId);

	function validateName(name: string): string {
		const trimmed = name.trim();
		if (trimmed.length < 3) return "Name must be at least 3 characters";
		if (trimmed.length > 10) return "Name must be at most 10 characters";
		if (!/^[A-Za-z][A-Za-z ' -]*$/.test(trimmed))
			return "Only letters, spaces, hyphens, and apostrophes allowed";
		return "";
	}

	async function handleStart() {
		if (!selectedClassId) return;
		const error = validateName(heroName);
		if (error) {
			setNameError(error);
			return;
		}
		setNameError("");
		try {
			const data = await createGame.mutateAsync({
				classId: selectedClassId,
				heroName: heroName.trim(),
			});
			setStateFromServer({ gameId: data.gameId, turn: data.state.turn, state: data.state });
			storeGameId(data.gameId);
			navigate("/game");
		} catch (e) {
			showError(getApiErrorMessage(e));
		}
	}

	return (
		<div className="min-h-screen bg-bg-base flex flex-col items-center px-4 py-8">
			{/* Header */}
			<div className="w-full max-w-3xl mb-6">
				<div className="flex items-baseline justify-between mb-2">
					<h1 className="text-primary text-xl">Choose your class</h1>
					<button
						type="button"
						onClick={() => navigate("/")}
						className="text-sm text-text-muted hover:text-text-bright transition-colors focus:outline-none"
					>
						← Back
					</button>
				</div>
				<div className="border-b-2 border-border" />
			</div>

			{/* Class grid */}
			<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-3xl mb-6">
				{classes.map((cls) => (
					<ClassCard
						key={cls.id}
						cls={cls}
						selected={selectedClassId === cls.id}
						onSelect={() => setSelectedClassId(cls.id)}
					/>
				))}
			</div>

			{/* Name section */}
			{selectedClass && (
				<div className="w-full max-w-sm">
					<div className="border-b-2 border-border mb-5" />
					<p className="text-text text-base mb-4">
						You have chosen: <span className="text-primary">{selectedClass.name}</span>
					</p>

					<div className="flex items-end gap-2 mb-3">
						<div className="flex-1">
							<Input
								label="Hero name"
								value={heroName}
								onChange={(e) => {
									setHeroName(e.target.value);
									if (nameError) setNameError(validateName(e.target.value));
								}}
								error={nameError}
								maxLength={10}
								placeholder="Enter a name..."
							/>
						</div>
						<Button
							variant="ghost"
							size="md"
							onClick={() => {
								setHeroName(randomHeroName());
								setNameError("");
							}}
							className="shrink-0 mb-[2px]"
						>
							Randomize
						</Button>
					</div>

					<Button
						variant="primary"
						size="lg"
						onClick={handleStart}
						disabled={createGame.isPending}
						className="w-full"
					>
						{createGame.isPending ? "Creating…" : "Begin Adventure"}
					</Button>
				</div>
			)}
		</div>
	);
}
