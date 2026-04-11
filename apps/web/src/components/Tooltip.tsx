import { type ReactNode, useState } from "react";
import {
	useFloating,
	useHover,
	useFocus,
	useInteractions,
	FloatingPortal,
	offset,
	flip,
	shift,
	autoUpdate,
	type Placement,
} from "@floating-ui/react";

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
	/** Preferred placement. Floating UI will flip/shift automatically if there is no room. */
	side?: "top" | "right" | "bottom" | "left";
	/** Render the trigger as an inline element instead of a block div. */
	inline?: boolean;
};

/**
 * Generic tooltip wrapper. Renders `content` in a portal so it escapes any
 * ancestor overflow clipping. Floating UI handles collision detection and
 * automatically flips to whichever side has space.
 *
 * The trigger wrapper is a `div` by default; pass `inline` to use a `span`
 * instead (needed when the tooltip sits inside inline/paragraph text).
 */
export function Tooltip({ content, children, side = "top", inline = false }: TooltipProps) {
	const [open, setOpen] = useState(false);

	const placement: Placement = side;

	const { refs, floatingStyles, context } = useFloating({
		open,
		onOpenChange: setOpen,
		placement,
		whileElementsMounted: autoUpdate,
		middleware: [
			offset(8),
			flip({ fallbackAxisSideDirection: "start" }),
			shift({ padding: 8 }),
		],
	});

	const hover = useHover(context, { delay: { open: 100, close: 0 } });
	const focus = useFocus(context);
	const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus]);

	return (
		<>
			{inline ? (
				<span ref={refs.setReference} {...getReferenceProps()}>
					{children}
				</span>
			) : (
				<div ref={refs.setReference} {...getReferenceProps()}>
					{children}
				</div>
			)}
			{open && (
				<FloatingPortal>
					<div
						ref={refs.setFloating}
						role="tooltip"
						style={floatingStyles}
						{...getFloatingProps()}
						className="z-50 w-64 border-2 border-border bg-black text-text pointer-events-none"
					>
						{/* Corner glyphs */}
						<span style={{ ...CORNER, top: -2, left: -2 }}>╔</span>
						<span style={{ ...CORNER, top: -2, right: -2 }}>╗</span>
						<span style={{ ...CORNER, bottom: -2, left: -2 }}>╚</span>
						<span style={{ ...CORNER, bottom: -2, right: -2 }}>╝</span>

						{content}
					</div>
				</FloatingPortal>
			)}
		</>
	);
}
