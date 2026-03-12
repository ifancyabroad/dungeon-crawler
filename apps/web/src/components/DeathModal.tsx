import { useNavigate } from "react-router-dom";
import { Modal } from "./Modal";
import { Button } from "./Button";

type DeathModalProps = {
	open: boolean;
};

export function DeathModal({ open }: DeathModalProps) {
	const navigate = useNavigate();

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
