import { Modal } from "./Modal";
import { Button } from "./Button";
import { useGameStore } from "../features/game/gameStore";

export function LevelUpModal() {
	const levelUpEvents = useGameStore((s) => s.levelUpEvents);
	const dismissLevelUp = useGameStore((s) => s.dismissLevelUp);
	const current = levelUpEvents[0];

	return (
		<Modal
			open={current !== undefined}
			onClose={dismissLevelUp}
			title="Level Up!"
			footer={
				<Button variant="primary" size="md" onClick={dismissLevelUp}>
					Continue
				</Button>
			}
		>
			{current && (
				<div className="space-y-3">
					<p className="text-base text-text">
						You have reached{" "}
						<span className="text-primary">Level {current.newLevel}</span>.
					</p>
					<div className="border-t border-border pt-3">
						<div className="flex justify-between">
							<span className="text-sm text-text-label">HP gained</span>
							<span className="text-sm text-hp-text">+{current.hpGained}</span>
						</div>
					</div>
				</div>
			)}
		</Modal>
	);
}
