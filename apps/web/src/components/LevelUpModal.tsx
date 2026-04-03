/**
 * LevelUpModal — shown when the hero levels up and must pick a new skill.
 *
 * Visibility and content are driven exclusively by `state.pendingInteraction`.
 * The modal cannot be dismissed until the player picks a skill (or rerolls).
 * This mirrors the server state, so a page refresh correctly restores the modal.
 *
 * Actions dispatched here (`select_skill_choice`, `reroll_skill_choice`) advance the turn
 * but skip enemy processing and cooldown/status ticks — they only resolve the interaction.
 */

import { skillsById } from "@app/content";
import { GAME_CONFIG, getHero } from "@app/shared";
import { useGameStore } from "../features/game/gameStore";
import { Modal } from "./Modal";
import { Button } from "./Button";

const RANK_LABELS = ["I", "II", "III"] as const;

export function LevelUpModal() {
	const state = useGameStore((s) => s.state);
	const sendAction = useGameStore((s) => s.sendAction);
	const actionInProgress = useGameStore((s) => s.actionInProgress);

	const pi = state?.pendingInteraction;
	// Wait for any in-progress animation (attack bump, skill FX, etc.) to finish
	// before showing the modal, so it doesn't interrupt the kill animation.
	if (!pi || pi.type !== "skill_choice" || actionInProgress) return null;

	const { levelReached, offers, rerollsUsed, rerollCost } = pi;

	// Count the hero's current active and passive skills for cap progress display
	const heroActor = state ? getHero(state) : undefined;

	const heroSkillIds = heroActor ? Object.keys(heroActor.skills) : [];
	let activeCount = 0;
	let passiveCount = 0;
	for (const skillId of heroSkillIds) {
		const def = skillsById[skillId as keyof typeof skillsById];
		if (def?.skillType === "active") activeCount++;
		else if (def?.skillType === "passive") passiveCount++;
	}

	const { activeSkillCap, passiveSkillCap } = GAME_CONFIG.leveling;

	function handlePick(skillId: string) {
		sendAction({ type: "select_skill_choice", skillId });
	}

	function handleReroll() {
		sendAction({ type: "reroll_skill_choice" });
	}

	return (
		<Modal
			open
			onClose={() => {
				// No-op: the modal cannot be dismissed while a skill choice is pending.
				// The player must pick a skill or reroll.
			}}
			title={`Level ${levelReached} — Choose a Skill`}
		>
			<div className="space-y-4">
				{/* Cap progress */}
				<div className="flex gap-4 text-sm font-mono">
					<span className="text-primary">
						Active {activeCount}/{activeSkillCap}
					</span>
					<span className="text-text-muted">·</span>
					<span className="text-secondary">
						Passive {passiveCount}/{passiveSkillCap}
					</span>
				</div>

				{offers.length === 0 ? (
					<p className="text-text-muted">
						No more skills available from your class pool.
					</p>
				) : (
					<div className="space-y-2">
						{offers.map(({ skillId, rank }) => {
							const def = skillsById[skillId as keyof typeof skillsById];
							if (!def) return null;
							const isPassive = def.skillType === "passive";
							const isUpgrade = (heroActor?.skills[skillId]?.rank ?? 0) > 0;
							const rankLabel = RANK_LABELS[rank - 1];
							return (
								<button
									key={skillId}
									onClick={() => handlePick(skillId)}
									className={[
										"w-full text-left px-3 py-2 border transition-colors",
										"border-border hover:border-border-bright hover:bg-bg-elevated",
										"focus:outline-none focus:ring-1 focus:ring-primary",
									].join(" ")}
								>
									<div className="flex items-start justify-between gap-2">
										<div className="min-w-0">
											<div className="flex items-center gap-2">
												<p className="text-text-bright font-mono">
													{def.name}
												</p>
												{isUpgrade && (
													<span className="text-xs font-mono text-text-muted border border-border px-1 py-px uppercase tracking-wide">
														Upgrade
													</span>
												)}
											</div>
											<p className="text-text-muted leading-snug mt-0.5">
												{def.description}
											</p>
										</div>
										<div className="flex flex-col items-end gap-1 shrink-0">
											<span
												className={[
													"px-1.5 py-0.5 border uppercase tracking-wide font-mono text-xs",
													isPassive
														? "border-secondary text-secondary"
														: "border-primary text-primary",
												].join(" ")}
											>
												{isPassive ? "Passive" : "Active"}
											</span>
											{rankLabel && (
												<span className="text-xs font-mono text-text-muted">
													Rank {rankLabel}
												</span>
											)}
										</div>
									</div>
								</button>
							);
						})}
					</div>
				)}

				<div className="border-t border-border pt-3 flex items-center justify-between">
					<Button
						variant="secondary"
						size="sm"
						onClick={handleReroll}
						disabled={(heroActor?.gold ?? 0) < rerollCost}
					>
						Reroll — {rerollCost} gold
						{rerollsUsed > 0 && (
							<span className="ml-1 text-text-muted">(×{rerollsUsed})</span>
						)}
					</Button>
					{(heroActor?.gold ?? 0) < rerollCost && (
						<p className="text-text-muted">Not enough gold.</p>
					)}
				</div>
			</div>
		</Modal>
	);
}
