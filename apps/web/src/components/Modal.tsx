import { useEffect, useRef, type ReactNode } from "react";
import { PanelBox } from "./PanelBox";

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

	// PanelBox title bar only accepts a string; for ReactNode titles we fall back
	// to rendering the title manually inside the body. In practice all current
	// call-sites pass plain strings, so the string branch covers everything.
	const titleString = typeof title === "string" ? title : undefined;

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center p-4"
			aria-modal="true"
			role="dialog"
			aria-labelledby={title ? "modal-title" : undefined}
		>
			{/* Pure black backdrop */}
			<div className="fixed inset-0 bg-black/90" onClick={onClose} aria-hidden="true" />

			<div
				ref={panelRef}
				className={`relative z-10 w-full max-w-lg max-h-[90vh] flex flex-col ${className}`}
				onClick={(e) => e.stopPropagation()}
			>
				<PanelBox
					title={titleString}
					footer={
						footer != null ? (
							<div className="flex justify-end gap-2 py-1">{footer}</div>
						) : undefined
					}
					className="flex flex-col max-h-[90vh]"
				>
					{/* ReactNode title fallback (non-string) */}
					{title != null && titleString == null && (
						<div className="shrink-0 border-b border-border px-4 py-2">
							<h2 id="modal-title" className="text-primary uppercase tracking-widest">
								{title}
							</h2>
						</div>
					)}

					{/* Body — scrollable */}
					<div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-text">
						{children}
					</div>
				</PanelBox>
			</div>
		</div>
	);
}
