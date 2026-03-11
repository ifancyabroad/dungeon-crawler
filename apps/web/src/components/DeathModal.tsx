import { useNavigate } from "react-router-dom";
import { Modal } from "./Modal";
import { Button } from "./Button";

type DeathModalProps = {
	open: boolean;
};

export function DeathModal({ open }: DeathModalProps) {
	const navigate = useNavigate();

	function handleReturnToMenu() {
		navigate("/");
	}

	function handleNewCharacter() {
		navigate("/character-create");
	}

	return (
		<Modal
			open={open}
			onClose={() => {}}
			title="You Have Died"
			footer={
				<>
					<Button variant="secondary" size="md" onClick={handleReturnToMenu}>
						Return to Menu
					</Button>
					<Button variant="primary" size="md" onClick={handleNewCharacter}>
						New Character
					</Button>
				</>
			}
		>
			<p className="text-text-muted">
				Your hero has fallen in the dungeon. Their journey ends here.
			</p>
		</Modal>
	);
}
