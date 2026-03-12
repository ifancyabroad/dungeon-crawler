import { useEffect, useRef, type ReactNode } from "react";

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
			{/* Pure black backdrop, no opacity blending */}
			<div className="fixed inset-0 bg-black/90" onClick={onClose} aria-hidden="true" />

			{/* Panel — DCSS style: warm dark bg, amber border */}
			<div
				ref={panelRef}
				className={[
					"relative z-10 w-full max-w-lg max-h-[90vh] flex flex-col",
					"border-2 border-border bg-bg-panel",
					className,
				].join(" ")}
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				{title != null && (
					<div className="shrink-0 border-b-2 border-border px-4 py-2">
						<h2 id="modal-title" className="text-primary text-base">
							{title}
						</h2>
					</div>
				)}

				{/* Body */}
				<div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-text">{children}</div>

				{/* Footer */}
				{footer != null && (
					<div className="shrink-0 border-t-2 border-border px-4 py-3 flex justify-end gap-2">
						{footer}
					</div>
				)}
			</div>
		</div>
	);
}
