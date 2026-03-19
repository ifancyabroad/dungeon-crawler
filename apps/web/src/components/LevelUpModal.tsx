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
import { useGameStore } from "../features/game/gameStore";
import { Modal } from "./Modal";
import { Button } from "./Button";

export function LevelUpModal() {
	const state = useGameStore((s) => s.state);
	const sendAction = useGameStore((s) => s.sendAction);
	const actionInProgress = useGameStore((s) => s.actionInProgress);

	const pi = state?.pendingInteraction;
	// Wait for any in-progress animation (attack bump, skill FX, etc.) to finish
	// before showing the modal, so it doesn't interrupt the kill animation.
	if (!pi || pi.type !== "skill_choice" || actionInProgress) return null;

	const { offerType, levelReached, offers, rerollsUsed } = pi;

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
			title={`Level ${levelReached} — Choose a ${offerType === "passive" ? "Passive" : "Active"} Skill`}
		>
			<div className="space-y-4">
				<p className="text-text-muted">
					{offerType === "passive"
						? "Select a permanent buff to enhance your hero."
						: "Select a new active skill to add to your hotbar."}
				</p>

				{offers.length === 0 ? (
					<p className="text-text-muted">
						No more skills available from your class pool.
					</p>
				) : (
					<div className="space-y-2">
						{offers.map((skillId) => {
							const def = skillsById[skillId as keyof typeof skillsById];
							if (!def) return null;
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
											<p className="text-text-bright font-mono">{def.name}</p>
											<p className="text-text-muted leading-snug mt-0.5">
												{def.description}
											</p>
										</div>
										<span
											className={[
												"shrink-0 px-1.5 py-0.5 border uppercase tracking-wide font-mono",
												def.skillType === "passive"
													? "border-secondary text-secondary"
													: "border-primary text-primary",
											].join(" ")}
										>
											{def.skillType === "passive" ? "Passive" : "Active"}
										</span>
									</div>
								</button>
							);
						})}
					</div>
				)}

				<div className="border-t border-border pt-3 flex items-center justify-between">
					<Button variant="secondary" size="sm" onClick={handleReroll}>
						Reroll
						{rerollsUsed > 0 && (
							<span className="ml-1 text-text-muted">(×{rerollsUsed})</span>
						)}
					</Button>
					<p className="text-text-muted">Rerolls are free for now.</p>
				</div>
			</div>
		</Modal>
	);
}
