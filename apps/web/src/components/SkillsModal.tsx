import { Modal } from "./Modal";
import { useUiStore } from "../features/ui/uiStore";

export function SkillsModal() {
	const openModal = useUiStore((s) => s.openModal);
	const close = useUiStore((s) => s.close);

	return (
		<Modal open={openModal === "skills"} onClose={close} title="Skills">
			<p className="text-text-muted italic">Skills coming soon.</p>
		</Modal>
	);
}
