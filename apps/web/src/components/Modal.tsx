import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./Button";

type ModalProps = {
	open: boolean;
	onClose: () => void;
	title?: ReactNode;
	children: ReactNode;
	footer?: ReactNode;
	className?: string;
};

export function Modal({ open, onClose, title, children, footer, className = "" }: ModalProps) {
	const panelRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;

		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};

		document.addEventListener("keydown", handleEscape);
		return () => document.removeEventListener("keydown", handleEscape);
	}, [open, onClose]);

	if (!open) return null;

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center p-4"
			aria-modal="true"
			role="dialog"
			aria-labelledby={title ? "modal-title" : undefined}
		>
			<div className="fixed inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
			<div
				ref={panelRef}
				className={[
					"relative z-10 w-full max-w-lg max-h-[90vh] flex flex-col",
					"rounded border border-border bg-bg-surface shadow-xl",
					className,
				].join(" ")}
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-4 py-3">
					{title != null && (
						<h2 id="modal-title" className="text-lg font-semibold text-text">
							{title}
						</h2>
					)}
					<Button
						variant="ghost"
						size="sm"
						onClick={onClose}
						aria-label="Close"
						className={title == null ? "ml-auto" : ""}
					>
						×
					</Button>
				</div>

				{/* Body */}
				<div className="min-h-0 flex-1 overflow-y-auto p-4 text-text">{children}</div>

				{/* Footer */}
				{footer != null && (
					<div className="shrink-0 border-t border-border px-4 py-3 flex justify-end gap-2">
						{footer}
					</div>
				)}
			</div>
		</div>
	);
}
