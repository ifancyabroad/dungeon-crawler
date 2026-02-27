import { useEffect, useRef } from "react";
import type Phaser from "phaser";
import { createGame } from "../game/createGame";
import { useMapStore } from "../stores/mapStore";

type Props = {
	className?: string;
	children?: React.ReactNode;
};

/**
 * Hosts the Phaser game canvas (Preload + Main scene).
 * Overlay content (HUD) is rendered as children on top.
 * Registers the game instance with the store so the sidebar can request map regeneration.
 */
export default function GameCanvas({ className, children }: Props) {
	const hostRef = useRef<HTMLDivElement>(null);
	const gameRef = useRef<Phaser.Game | null>(null);
	const setGameRef = useMapStore((s) => s.setGameRef);

	useEffect(() => {
		if (!hostRef.current || gameRef.current) return;
		gameRef.current = createGame(hostRef.current);
		setGameRef(gameRef.current);
		return () => {
			setGameRef(null);
			gameRef.current?.destroy(true);
			gameRef.current = null;
		};
	}, [setGameRef]);

	return (
		<div
			className={["relative w-full h-full overflow-hidden bg-bg-base", className || ""].join(
				" ",
			)}
		>
			<div ref={hostRef} className="absolute inset-0" />
			{children ? (
				<div className="absolute inset-0 pointer-events-none">
					<div className="pointer-events-auto">{children}</div>
				</div>
			) : null}
		</div>
	);
}
