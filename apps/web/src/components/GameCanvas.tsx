import { useEffect, useRef, useState } from "react";
import type Phaser from "phaser";
import { createGame } from "../game/createGame";
import { useMapStore } from "../features/map/mapStore";
import { Loader } from "./Loader";

type Props = {
	className?: string;
	children?: React.ReactNode;
};

/**
 * Hosts the Phaser game canvas (Preload + Main scene).
 * Registers the game instance in mapStore. Hero position is synced from gameStore inside Main scene for minimal latency.
 */
const PRELOAD_COMPLETE_KEY = "onPreloadComplete";

export default function GameCanvas({ className, children }: Props) {
	const hostRef = useRef<HTMLDivElement>(null);
	const gameRef = useRef<Phaser.Game | null>(null);
	const [showLoadingOverlay, setShowLoadingOverlay] = useState(true);
	const setGameRef = useMapStore((s) => s.setGameRef);

	// Mount: create Phaser game, register in store. Unmount: destroy and clear.
	useEffect(() => {
		if (!hostRef.current || gameRef.current) return;
		const game = createGame(hostRef.current);
		gameRef.current = game;
		setGameRef(game);
		game.registry.set(PRELOAD_COMPLETE_KEY, () => setShowLoadingOverlay(false));
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
			{showLoadingOverlay ? (
				<div className="absolute inset-0 flex items-center justify-center bg-bg-base">
					<Loader />
				</div>
			) : null}
			{children ? (
				<div className="absolute inset-0 pointer-events-none">
					<div className="pointer-events-auto">{children}</div>
				</div>
			) : null}
		</div>
	);
}
