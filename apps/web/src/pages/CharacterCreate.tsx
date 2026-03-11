import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { classes } from "@app/content";
import type { CharacterClassDefinition } from "@app/content";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { TileSprite } from "../components/TileSprite";
import { useCreateGame } from "../features/game/useGames";
import { useGameStore } from "../features/game/gameStore";
import { useErrorStore } from "../features/error/errorStore";
import { getApiErrorMessage } from "../lib/errors";
import { getHeroTile } from "../game/tiles/tilesetRegistry";
import { randomHeroName } from "../lib/nameGenerator";

const STAT_LABELS: { key: keyof CharacterClassDefinition["baseAttributes"]; label: string }[] = [
	{ key: "strength", label: "STR" },
	{ key: "dexterity", label: "DEX" },
	{ key: "constitution", label: "CON" },
	{ key: "intelligence", label: "INT" },
	{ key: "wisdom", label: "WIS" },
	{ key: "charisma", label: "CHA" },
];

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
		<div className="min-h-screen bg-bg-base flex flex-col items-center px-4 py-12">
			<h1 className="text-2xl font-semibold text-text mb-2">Create Your Hero</h1>
			<p className="text-text-muted mb-8">Choose a class to begin your adventure</p>

			{/* Class selection */}
			<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl mb-8">
				{classes.map((cls) => {
					const isSelected = selectedClassId === cls.id;
					return (
						<button
							key={cls.id}
							type="button"
							onClick={() => setSelectedClassId(cls.id)}
							className={[
								"rounded border p-4 text-left transition-colors",
								"bg-bg-surface hover:bg-bg-elevated",
								isSelected ? "border-primary ring-1 ring-primary" : "border-border",
							].join(" ")}
						>
							<div className="flex items-center gap-3 mb-3">
								<TileSprite tileIndex={getHeroTile(cls.id)} size={48} />
								<div>
									<h2 className="text-base font-semibold text-text">
										{cls.name}
									</h2>
									<p className="text-xs text-text-muted capitalize">
										{cls.resource}
									</p>
								</div>
							</div>
							<p className="text-sm text-text-muted mb-3">{cls.description}</p>
							<div className="grid grid-cols-3 gap-x-3 gap-y-1">
								{STAT_LABELS.map(({ key, label }) => (
									<div key={key} className="flex justify-between text-xs">
										<span className="text-text-muted">{label}</span>
										<span className="text-text font-medium tabular-nums">
											{cls.baseAttributes[key]}
										</span>
									</div>
								))}
							</div>
							<div className="mt-2 flex justify-between text-xs">
								<span className="text-text-muted">HP</span>
								<span className="text-text font-medium tabular-nums">
									{cls.startingHp}
								</span>
							</div>
						</button>
					);
				})}
			</div>

			{/* Name input (shown after class selection) */}
			{selectedClass && (
				<div className="w-full max-w-sm space-y-4">
					<div className="flex items-end gap-2">
						<div className="flex-1">
							<Input
								label="Hero Name"
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
								const name = randomHeroName();
								setHeroName(name);
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
						{createGame.isPending ? "Creating..." : "Begin Adventure"}
					</Button>

					<Button
						variant="ghost"
						size="sm"
						onClick={() => navigate("/")}
						className="w-full"
					>
						Back
					</Button>
				</div>
			)}
		</div>
	);
}
