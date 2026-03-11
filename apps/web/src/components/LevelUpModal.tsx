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
					<p className="text-text">
						You have reached{" "}
						<span className="font-semibold text-primary">Level {current.newLevel}</span>
						!
					</p>
					<p className="text-text-muted">
						You gain{" "}
						<span className="font-semibold text-success">+{current.hpGained} HP</span>.
					</p>
				</div>
			)}
		</Modal>
	);
}
