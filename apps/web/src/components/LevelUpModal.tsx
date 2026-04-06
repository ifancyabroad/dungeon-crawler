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
import { SkillOfferCard } from "./SkillOfferCard";

export function LevelUpModal() {
	const state = useGameStore((s) => s.state);
	const sendAction = useGameStore((s) => s.sendAction);
	const actionInProgress = useGameStore((s) => s.actionInProgress);
	const pi = state?.pendingInteraction;
	// Wait for any in-progress animation (attack bump, skill FX, etc.) to finish
	// before showing the modal, so it doesn't interrupt the kill animation.
	if (!pi || pi.type !== "skill_choice" || actionInProgress) return null;

	const { levelReached, hpGained, offers, rerollsUsed, rerollCost } = pi;

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
	const gold = heroActor?.gold ?? 0;

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
			title="Level Up!"
		>
			<div className="space-y-4">
				{/* Compact header: level + HP on one line, caps on the next */}
				<div className="space-y-1 font-mono">
					<p className="text-text-bright">
						You have reached level {levelReached}
						{hpGained != null && hpGained > 0 && (
							<>
								{" "}
								and gained <span className="text-success">+{hpGained} max HP</span>
							</>
						)}
						.
					</p>
					<div className="flex items-center gap-3">
						<span className="text-primary">
							Active {activeCount}/{activeSkillCap}
						</span>
						<span className="text-text-muted">·</span>
						<span className="text-secondary">
							Passive {passiveCount}/{passiveSkillCap}
						</span>
					</div>
				</div>

				{/* Skill offers */}
				{offers.length === 0 ? (
					<p className="text-text-muted font-mono">
						No more skills available from your class pool.
					</p>
				) : (
					<div className="space-y-1">
						{offers.map(({ skillId, rank }) => {
							const def = skillsById[skillId as keyof typeof skillsById];
							if (!def) return null;
							const isUpgrade = (heroActor?.skills[skillId]?.rank ?? 0) > 0;
							return (
								<SkillOfferCard
									key={skillId}
									def={def}
									rank={rank}
									isUpgrade={isUpgrade}
									onClick={() => handlePick(skillId)}
								/>
							);
						})}
					</div>
				)}

				{/* Footer: reroll on the left, current gold on the right */}
				<div className="border-t border-border pt-3 flex items-center justify-between gap-4">
					<Button variant="secondary" onClick={handleReroll} disabled={gold < rerollCost}>
						Reroll — {rerollCost} gold
						{rerollsUsed > 0 && (
							<span className="ml-1 text-text-muted">(×{rerollsUsed})</span>
						)}
					</Button>
					<span className="font-mono text-text-muted shrink-0">{gold} gold</span>
				</div>
			</div>
		</Modal>
	);
}
