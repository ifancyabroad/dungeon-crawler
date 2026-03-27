import { useNavigate } from "react-router-dom";
import { useGameStore } from "../features/game/gameStore";
import { Modal } from "./Modal";
import { Button } from "./Button";

/** Visibility follows `showDefeatModal` (set on authoritative alive→dead transition in the game store). */
export function DeathModal() {
	const navigate = useNavigate();
	const open = useGameStore((s) => s.showDefeatModal);

	return (
		<Modal
			open={open}
			onClose={() => {}}
			title="You have died."
			footer={
				<>
					<Button variant="secondary" size="md" onClick={() => navigate("/")}>
						Return to Menu
					</Button>
					<Button
						variant="primary"
						size="md"
						onClick={() => navigate("/character-create")}
					>
						New Character
					</Button>
				</>
			}
		>
			<p className="text-base text-text italic">
				Your hero has fallen in the darkness. Their deeds will not be forgotten.
			</p>
		</Modal>
	);
}
