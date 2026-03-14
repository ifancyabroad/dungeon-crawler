import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { classes } from "@app/content";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { ClassCard } from "../components/ClassCard";
import { PanelBox } from "../components/PanelBox";
import { Modal } from "../components/Modal";
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
	const [namingOpen, setNamingOpen] = useState(false);
	const [heroName, setHeroName] = useState(() => randomHeroName());
	const [nameError, setNameError] = useState("");

	const selectedClass = classes.find((c) => c.id === selectedClassId);

	function validateName(name: string): string {
		const trimmed = name.trim();
		if (trimmed.length < 3) return "Name must be at least 3 characters";
		if (trimmed.length > 10) return "Name must be at most 10 characters";
		if (!/^[A-Za-z][A-Za-z ' -]*$/.test(trimmed))
			return "Only letters, spaces, hyphens, and apostrophes allowed";
		return "";
	}

	function handleSelectClass(id: string) {
		setSelectedClassId(id);
		setHeroName(randomHeroName());
		setNameError("");
		setNamingOpen(true);
	}

	function handleCloseNaming() {
		setNamingOpen(false);
		setNameError("");
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
		<>
			<div className="min-h-screen bg-bg-base flex flex-col items-center justify-center p-4 overflow-hidden">
				{/* Back button — top-right, matching game page style */}
				<div className="absolute top-3 right-3">
					<Button
						variant="secondary"
						onClick={() => navigate("/")}
						aria-label="Return to main menu"
					>
						← Menu
					</Button>
				</div>

				{/* Title */}
				<div className="text-center mb-8">
					<h1 className="font-mono text-5xl tracking-widest uppercase text-primary mb-2">
						Dungeon Crawler
					</h1>
					<div className="flex items-center justify-center gap-3 mt-1">
						<span className="text-border font-mono select-none">~*~</span>
						<span className="text-secondary font-mono tracking-widest uppercase">
							Choose Your Class
						</span>
						<span className="text-border font-mono select-none">~*~</span>
					</div>
				</div>

				{/* Class selection panel */}
				<div className="w-full max-w-2xl">
					<PanelBox
						footer={
							<span className="text-text-muted font-mono">
								Select a class to begin your adventure
							</span>
						}
					>
						<div className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-px bg-border">
							{classes.map((cls) => (
								<ClassCard
									key={cls.id}
									cls={cls}
									selected={selectedClassId === cls.id}
									onSelect={() => handleSelectClass(cls.id)}
								/>
							))}
						</div>
					</PanelBox>
				</div>

				{/* Flavour line */}
				<div className="mt-5 text-text-muted font-mono text-center">
					<p>Choose wisely. Your fate awaits below.</p>
				</div>
			</div>

			{/* Name hero modal */}
			<Modal
				open={namingOpen}
				onClose={handleCloseNaming}
				title={selectedClass ? `Name Your ${selectedClass.name}` : "Name Your Hero"}
				footer={
					<>
						<Button variant="ghost" size="md" onClick={handleCloseNaming}>
							← Back
						</Button>
						<Button
							variant="primary"
							size="md"
							onClick={handleStart}
							disabled={createGame.isPending}
						>
							{createGame.isPending ? "Creating…" : "Begin Adventure"}
						</Button>
					</>
				}
			>
				<div className="space-y-4">
					{selectedClass && (
						<p className="text-text font-mono">
							&gt; A {selectedClass.name.toLowerCase()} steps forward from the
							shadows. What is their name?
						</p>
					)}
					<div className="flex items-end gap-2">
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
				</div>
			</Modal>
		</>
	);
}
