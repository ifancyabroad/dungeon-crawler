import { type ReactNode } from "react";

type PanelBoxProps = {
	children: ReactNode;
	title?: string;
	footer?: ReactNode;
	glow?: boolean;
	className?: string;
};

// Corner glyph style shared across all four positions.
const CORNER: React.CSSProperties = {
	position: "absolute",
	fontFamily: "'IBM VGA', monospace",
	fontSize: "1rem",
	lineHeight: 1,
	color: "var(--color-border)",
	pointerEvents: "none",
	userSelect: "none",
	zIndex: 1,
};

/**
 * PanelBox — the shared bordered panel primitive for the whole UI.
 *
 * Provides:
 *   - border-2 border-border bg-bg-panel base
 *   - ╔ ╗ ╚ ╝ corner glyphs (always)
 *   - optional "+-- TITLE ──...──+" header bar
 *   - optional footer slot
 *   - optional amber glow shadow (use on prominent/hero panels only)
 */
export function PanelBox({ children, title, footer, glow = false, className = "" }: PanelBoxProps) {
	return (
		<div
			className={`relative border-2 border-border bg-bg-panel ${className}`}
			style={
				glow
					? { boxShadow: "0 0 24px rgba(80,60,16,0.4), inset 0 0 32px rgba(0,0,0,0.4)" }
					: undefined
			}
		>
			{/* Corner glyphs */}
			<span style={{ ...CORNER, top: -2, left: -2 }}>╔</span>
			<span style={{ ...CORNER, top: -2, right: -2 }}>╗</span>
			<span style={{ ...CORNER, bottom: -2, left: -2 }}>╚</span>
			<span style={{ ...CORNER, bottom: -2, right: -2 }}>╝</span>

			{/* Title bar */}
			{title != null && (
				<div className="border-b border-border px-4 py-1.5 flex items-center gap-2 overflow-hidden">
					<span className="text-border font-mono select-none shrink-0">+--</span>
					<span className="text-text-label font-mono tracking-widest uppercase shrink-0">
						{title}
					</span>
					<span
						className="text-border font-mono select-none flex-1 overflow-hidden whitespace-nowrap"
						aria-hidden
					>
						{"─".repeat(80)}
					</span>
					<span className="text-border font-mono select-none shrink-0">--+</span>
				</div>
			)}

			{/* Body */}
			{children}

			{/* Footer bar */}
			{footer != null && (
				<div className="border-t border-border px-4 py-1 flex items-center gap-2">
					<span className="text-border font-mono select-none shrink-0">+--</span>
					<div className="flex-1 min-w-0">{footer}</div>
					<span className="text-border font-mono select-none shrink-0">--+</span>
				</div>
			)}
		</div>
	);
}
