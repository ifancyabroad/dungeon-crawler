import { Button } from "./Button";
import { Modal } from "./Modal";
import { useErrorStore } from "../features/error/errorStore";

export function ErrorModal() {
	const error = useErrorStore((s) => s.error);
	const closeError = useErrorStore((s) => s.closeError);

	return (
		<Modal
			open={error != null}
			onClose={closeError}
			title="Error"
			footer={
				<Button variant="primary" size="md" onClick={closeError}>
					OK
				</Button>
			}
		>
			<p className="text-error">{error ?? ""}</p>
		</Modal>
	);
}
