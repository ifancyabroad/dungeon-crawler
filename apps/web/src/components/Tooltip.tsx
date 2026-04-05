import { type ReactNode } from "react";

// Corner glyph style — matches PanelBox.tsx
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

type TooltipProps = {
	content: ReactNode;
	children: ReactNode;
};

/**
 * Generic tooltip wrapper. Renders `content` in a styled panel above the
 * trigger on hover, using pure CSS (no JS state, no portal).
 *
 * The trigger wrapper is a `div` — callers should move any `flex-none` or
 * sizing classes onto the `<Tooltip>` element if they were on the child.
 */
export function Tooltip({ content, children }: TooltipProps) {
	return (
		<div className="relative group/tooltip">
			{children}
			<div
				role="tooltip"
				className={[
					"pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50",
					"w-64 border-2 border-border bg-black text-text",
					"invisible opacity-0 group-hover/tooltip:visible group-hover/tooltip:opacity-100",
					"transition-opacity duration-150",
				].join(" ")}
			>
				{/* Corner glyphs */}
				<span style={{ ...CORNER, top: -2, left: -2 }}>╔</span>
				<span style={{ ...CORNER, top: -2, right: -2 }}>╗</span>
				<span style={{ ...CORNER, bottom: -2, left: -2 }}>╚</span>
				<span style={{ ...CORNER, bottom: -2, right: -2 }}>╝</span>

				{content}
			</div>
		</div>
	);
}
