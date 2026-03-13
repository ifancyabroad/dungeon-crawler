import { Modal } from "./Modal";
import { useUiStore } from "../features/ui/uiStore";

export function InventoryModal() {
	const openModal = useUiStore((s) => s.openModal);
	const close = useUiStore((s) => s.close);

	return (
		<Modal open={openModal === "inventory"} onClose={close} title="Inventory">
			<p className="text-text-muted italic">Inventory coming soon.</p>
		</Modal>
	);
}
