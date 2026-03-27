import { useEffect, useState } from "react";
import { skillsById } from "@app/content";
import { Button } from "./Button";
import { Input } from "./Input";
import { useGameStore } from "../features/game/gameStore";
import { useErrorStore } from "../features/error/errorStore";
import { getApiErrorMessage } from "../lib/errors";
import {
	useDebugGodModeStatus,
	useDebugSetGodMode,
	useDebugHeal,
	useDebugGiveSkill,
	useDebugKillEnemies,
	useDebugSetXp,
} from "../features/game/useDebugActions";

type DebugDrawerProps = {
	open: boolean;
	onClose: () => void;
};

const ALL_SKILLS = Object.values(skillsById)
	.map((s) => ({ id: s.id, name: s.name }))
	.sort((a, b) => a.name.localeCompare(b.name));

export default function DebugDrawer({ open, onClose }: DebugDrawerProps) {
	const [selectedSkillId, setSelectedSkillId] = useState(ALL_SKILLS[0]?.id ?? "");
	const [xpInput, setXpInput] = useState("");

	const setStateFromServer = useGameStore((s) => s.setStateFromServer);
	const debugGodMode = useGameStore((s) => s.debugGodMode);
	const setDebugGodMode = useGameStore((s) => s.setDebugGodMode);
	const gameId = useGameStore((s) => s.gameId);
	const showError = useErrorStore((s) => s.showError);

	const godModeStatus = useDebugGodModeStatus(open);
	const setGodMode = useDebugSetGodMode();
	const heal = useDebugHeal();
	const giveSkill = useDebugGiveSkill();
	const killEnemies = useDebugKillEnemies();
	const setXp = useDebugSetXp();

	// GET /debug/god-mode — align store when drawer opens (socket may not have fired yet).
	useEffect(() => {
		if (godModeStatus.data) setDebugGodMode(godModeStatus.data.godMode);
	}, [godModeStatus.data, setDebugGodMode]);

	const anyPending =
		setGodMode.isPending ||
		heal.isPending ||
		giveSkill.isPending ||
		killEnemies.isPending ||
		setXp.isPending;

	if (!open) return null;

	async function handleToggleGodMode() {
		const next = !useGameStore.getState().debugGodMode;
		try {
			await setGodMode.mutateAsync(next);
			setDebugGodMode(next);
		} catch (e) {
			showError(getApiErrorMessage(e));
		}
	}

	async function handleHeal() {
		try {
			const { state } = await heal.mutateAsync();
			if (gameId) setStateFromServer({ gameId, turn: state.turn, state });
		} catch (e) {
			showError(getApiErrorMessage(e));
		}
	}

	async function handleSetXp() {
		const n = parseInt(xpInput, 10);
		if (Number.isNaN(n) || n < 0) {
			showError("XP must be a non-negative integer.");
			return;
		}
		try {
			const { state } = await setXp.mutateAsync(n);
			if (gameId) setStateFromServer({ gameId, turn: state.turn, state });
		} catch (e) {
			showError(getApiErrorMessage(e));
		}
	}

	async function handleGiveSkill() {
		if (!selectedSkillId) return;
		try {
			const { state } = await giveSkill.mutateAsync(selectedSkillId);
			if (gameId) setStateFromServer({ gameId, turn: state.turn, state });
		} catch (e) {
			showError(getApiErrorMessage(e));
		}
	}

	async function handleKillEnemies() {
		try {
			const { state } = await killEnemies.mutateAsync();
			if (gameId) setStateFromServer({ gameId, turn: state.turn, state });
		} catch (e) {
			showError(getApiErrorMessage(e));
		}
	}

	return (
		<>
			<div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} aria-hidden />
			<aside
				className={[
					"fixed top-0 right-0 bottom-0 z-50 w-[280px]",
					"bg-bg-panel border-l-2 border-border overflow-y-auto",
				].join(" ")}
				aria-label="Debug drawer"
			>
				<div className="sticky top-0 z-10 border-b-2 border-border bg-bg-panel/95 backdrop-blur">
					<div className="flex items-center justify-between px-4 py-3">
						<h2 className="text-text">Debug</h2>
						<Button
							variant="ghost"
							size="icon"
							onClick={onClose}
							aria-label="Close drawer"
						>
							<svg
								className="w-4 h-4"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M6 18L18 6M6 6l12 12"
								/>
							</svg>
						</Button>
					</div>
				</div>

				<div className="p-4 space-y-6">
					{/* ── Hero ─────────────────────────────── */}
					<section className="space-y-3">
						<h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
							Hero
						</h3>

						{/* God mode toggle */}
						<div className="flex items-center justify-between">
							<span className="text-sm text-text">God Mode</span>
							<button
								type="button"
								role="switch"
								aria-checked={debugGodMode}
								disabled={anyPending}
								onClick={handleToggleGodMode}
								className={[
									"relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full",
									"border-2 border-transparent transition-colors duration-200",
									"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border",
									"disabled:opacity-50 disabled:cursor-not-allowed",
									debugGodMode ? "bg-success" : "bg-bg-input",
								].join(" ")}
							>
								<span
									className={[
										"pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow",
										"transform transition-transform duration-200",
										debugGodMode ? "translate-x-4" : "translate-x-0",
									].join(" ")}
								/>
							</button>
						</div>

						<Button
							variant="secondary"
							size="sm"
							onClick={handleHeal}
							disabled={anyPending}
							className="w-full"
						>
							{heal.isPending ? "Healing…" : "Heal to Full"}
						</Button>

						<div className="space-y-1.5">
							<Input
								label="Set XP"
								type="number"
								min={0}
								placeholder="e.g. 1000"
								value={xpInput}
								onChange={(e) => setXpInput(e.target.value)}
							/>
							<Button
								variant="ghost"
								size="sm"
								onClick={handleSetXp}
								disabled={anyPending}
								className="w-full"
							>
								{setXp.isPending ? "Applying…" : "Apply XP"}
							</Button>
						</div>
					</section>

					{/* ── Skills ───────────────────────────── */}
					<section className="space-y-3">
						<h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
							Skills
						</h3>

						<div className="space-y-1.5">
							<label
								className="block text-xs text-text-muted"
								htmlFor="debug-skill-select"
							>
								Skill
							</label>
							<select
								id="debug-skill-select"
								value={selectedSkillId}
								onChange={(e) => setSelectedSkillId(e.target.value)}
								className={[
									"w-full rounded border border-border bg-bg-input px-2 py-1.5",
									"text-sm text-text focus:outline-none focus:ring-1 focus:ring-border",
								].join(" ")}
							>
								{ALL_SKILLS.map((s) => (
									<option key={s.id} value={s.id}>
										{s.name}
									</option>
								))}
							</select>
						</div>

						<Button
							variant="secondary"
							size="sm"
							onClick={handleGiveSkill}
							disabled={anyPending || !selectedSkillId}
							className="w-full"
						>
							{giveSkill.isPending ? "Granting…" : "Give Skill"}
						</Button>
					</section>

					{/* ── Combat ───────────────────────────── */}
					<section className="space-y-3">
						<h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
							Combat
						</h3>

						<Button
							variant="secondary"
							size="sm"
							onClick={handleKillEnemies}
							disabled={anyPending}
							className="w-full"
						>
							{killEnemies.isPending ? "Killing…" : "Kill All Enemies"}
						</Button>
					</section>
				</div>
			</aside>
		</>
	);
}
