import { Modal } from "./Modal";
import { useUiStore } from "../features/ui/uiStore";

export function CharacterSheetModal() {
	const openModal = useUiStore((s) => s.openModal);
	const close = useUiStore((s) => s.close);

	return (
		<Modal open={openModal === "characterSheet"} onClose={close} title="Character Sheet">
			<p className="text-text-muted italic">Character sheet coming soon.</p>
		</Modal>
	);
}
