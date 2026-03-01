import { useEffect, useState } from "react";
import { Button } from "./Button";
import { Input } from "./Input";
import type { MapGenConfigOverride } from "../stores/mapStore";
import { DECORATION_WEIGHTS, getThemes } from "../game/tiles/tilesetRegistry";
import { DEFAULT_MAP_HEIGHT, DEFAULT_MAP_WIDTH } from "@app/shared";

const DEFAULT_SEED = 12345;
const MIN_SIZE = 10;
const MAX_SIZE = 80;

function clampSize(value: number): number {
	return Math.min(MAX_SIZE, Math.max(MIN_SIZE, value));
}

function configToFormState(c: MapGenConfigOverride | null) {
	if (!c) {
		return {
			width: String(DEFAULT_MAP_WIDTH),
			height: String(DEFAULT_MAP_HEIGHT),
			seed: String(DEFAULT_SEED),
			theme: "green_forest",
			algorithm: "cave" as const,
			scatterChance: "0.28",
			treeDensity: "50",
			wallThickness: "1",
			weightGrass: String(DECORATION_WEIGHTS.grass ?? 10),
			weightPlant: String(DECORATION_WEIGHTS.plant ?? 5),
			weightBush: String(DECORATION_WEIGHTS.bush ?? 3),
			weightRock: String(DECORATION_WEIGHTS.rock ?? 2),
		};
	}
	const treeDensity =
		c.algorithm === "cave" && c.caveFloorChance != null
			? String(Math.min(100, Math.max(0, Math.round((0.55 - c.caveFloorChance) * 500))))
			: "50";
	const wallThickness = c.bspRoomInset != null ? String(c.bspRoomInset) : "1";
	const w = c.decorationWeights ?? DECORATION_WEIGHTS;
	return {
		width: String(c.width),
		height: String(c.height),
		seed: String(c.seed),
		theme: c.theme ?? "green_forest",
		algorithm: (c.algorithm ?? "cave") as "bsp" | "cave",
		scatterChance: String(c.scatterChance ?? 0.28),
		treeDensity,
		wallThickness,
		weightGrass: String(w.grass ?? 10),
		weightPlant: String(w.plant ?? 5),
		weightBush: String(w.bush ?? 3),
		weightRock: String(w.rock ?? 2),
	};
}

export type DebugMapFormProps = {
	currentConfig: MapGenConfigOverride | null;
	onGenerate: (config: MapGenConfigOverride) => void;
	onClose?: () => void;
};

export default function DebugMapForm({ currentConfig, onGenerate, onClose }: DebugMapFormProps) {
	const themes = getThemes();
	const [formState, setFormState] = useState(() => configToFormState(currentConfig));

	useEffect(() => {
		setFormState(configToFormState(currentConfig));
	}, [currentConfig]);

	function handleGenerate() {
		const w = clampSize(parseInt(formState.width, 10) || DEFAULT_MAP_WIDTH);
		const h = clampSize(parseInt(formState.height, 10) || DEFAULT_MAP_HEIGHT);
		const s = parseInt(formState.seed, 10) || DEFAULT_SEED;
		const scatter = Math.max(0, Math.min(1, parseFloat(formState.scatterChance) || 0.28));
		const treeD = Math.max(0, Math.min(100, parseInt(formState.treeDensity, 10) || 50));
		const wallT = Math.max(1, Math.min(3, parseInt(formState.wallThickness, 10) || 1));
		const config: MapGenConfigOverride = {
			width: w,
			height: h,
			seed: s,
			theme: formState.theme || (themes[0] ?? "green_forest"),
			algorithm: formState.algorithm,
			scatterChance: scatter,
			caveFloorChance:
				formState.algorithm === "cave" ? 0.55 - (treeD / 100) * 0.2 : undefined,
			bspRoomInset: formState.algorithm === "bsp" ? wallT : undefined,
			decorationWeights: {
				grass: Math.max(0, parseInt(formState.weightGrass, 10) || 0),
				plant: Math.max(0, parseInt(formState.weightPlant, 10) || 0),
				bush: Math.max(0, parseInt(formState.weightBush, 10) || 0),
				rock: Math.max(0, parseInt(formState.weightRock, 10) || 0),
			},
		};
		onGenerate(config);
		onClose?.();
	}

	function handleRandomSeed() {
		setFormState((prev) => ({ ...prev, seed: String(Math.floor(Math.random() * 2147483647)) }));
	}

	return (
		<>
			<hr className="border-border" />
			<h2 className="text-xs font-medium uppercase tracking-wider text-text-muted">
				Map generation
			</h2>
			<div className="space-y-3">
				<Input
					label="Width"
					type="number"
					min={MIN_SIZE}
					max={MAX_SIZE}
					value={formState.width}
					onChange={(e) => setFormState((prev) => ({ ...prev, width: e.target.value }))}
				/>
				<Input
					label="Height"
					type="number"
					min={MIN_SIZE}
					max={MAX_SIZE}
					value={formState.height}
					onChange={(e) => setFormState((prev) => ({ ...prev, height: e.target.value }))}
				/>
				<div>
					<Input
						label="Seed"
						type="number"
						value={formState.seed}
						onChange={(e) =>
							setFormState((prev) => ({ ...prev, seed: e.target.value }))
						}
					/>
					<Button variant="ghost" size="sm" onClick={handleRandomSeed} className="mt-1.5">
						Randomize seed
					</Button>
				</div>
				<div>
					<label
						htmlFor="debug-form-theme"
						className="block text-sm font-medium text-text-muted mb-1.5"
					>
						Theme
					</label>
					<select
						id="debug-form-theme"
						value={formState.theme}
						onChange={(e) =>
							setFormState((prev) => ({ ...prev, theme: e.target.value }))
						}
						className="w-full rounded border border-border bg-bg-surface px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-bg-base"
					>
						{themes.map((t) => (
							<option key={t} value={t}>
								{t}
							</option>
						))}
					</select>
				</div>
				<div>
					<label
						htmlFor="debug-form-algorithm"
						className="block text-sm font-medium text-text-muted mb-1.5"
					>
						Algorithm
					</label>
					<select
						id="debug-form-algorithm"
						value={formState.algorithm}
						onChange={(e) =>
							setFormState((prev) => ({
								...prev,
								algorithm: e.target.value as "bsp" | "cave",
							}))
						}
						className="w-full rounded border border-border bg-bg-surface px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-bg-base"
					>
						<option value="bsp">BSP (rooms + corridors)</option>
						<option value="cave">Cave (organic, open)</option>
					</select>
				</div>
				<Input
					label="Scatter chance (0–1)"
					type="number"
					min={0}
					max={1}
					step={0.05}
					value={formState.scatterChance}
					onChange={(e) =>
						setFormState((prev) => ({ ...prev, scatterChance: e.target.value }))
					}
				/>
				{formState.algorithm === "cave" && (
					<Input
						label="Tree density (0–100)"
						type="number"
						min={0}
						max={100}
						value={formState.treeDensity}
						onChange={(e) =>
							setFormState((prev) => ({ ...prev, treeDensity: e.target.value }))
						}
					/>
				)}
				{formState.algorithm === "bsp" && (
					<Input
						label="Wall thickness (1–3)"
						type="number"
						min={1}
						max={3}
						value={formState.wallThickness}
						onChange={(e) =>
							setFormState((prev) => ({ ...prev, wallThickness: e.target.value }))
						}
					/>
				)}
				<div className="text-xs font-medium uppercase tracking-wider text-text-muted pt-1">
					Decoration weights
				</div>
				<div className="grid grid-cols-2 gap-2">
					<Input
						label="Grass"
						type="number"
						min={0}
						value={formState.weightGrass}
						onChange={(e) =>
							setFormState((prev) => ({ ...prev, weightGrass: e.target.value }))
						}
					/>
					<Input
						label="Plant"
						type="number"
						min={0}
						value={formState.weightPlant}
						onChange={(e) =>
							setFormState((prev) => ({ ...prev, weightPlant: e.target.value }))
						}
					/>
					<Input
						label="Bush"
						type="number"
						min={0}
						value={formState.weightBush}
						onChange={(e) =>
							setFormState((prev) => ({ ...prev, weightBush: e.target.value }))
						}
					/>
					<Input
						label="Rock"
						type="number"
						min={0}
						value={formState.weightRock}
						onChange={(e) =>
							setFormState((prev) => ({ ...prev, weightRock: e.target.value }))
						}
					/>
				</div>
				<Button variant="primary" size="md" onClick={handleGenerate} className="w-full">
					Generate map
				</Button>
			</div>
		</>
	);
}
