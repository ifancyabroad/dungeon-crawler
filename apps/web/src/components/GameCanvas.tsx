import { useEffect, useRef, useState } from "react";
import type Phaser from "phaser";
import { createGame } from "../game/createGame";
import { useMapStore } from "../features/map/mapStore";
import { useGameStore } from "../features/game/gameStore";
import { Loader } from "./Loader";

type Props = {
	className?: string;
	children?: React.ReactNode;
};

/** Main scene exposes this when running (for server-authoritative hero sync). */
type MainSceneWithHero = Phaser.Scene & { setHeroPosition?(idx: number): void };

/**
 * Hosts the Phaser game canvas (Preload + Main scene).
 * Registers the game instance in mapStore; syncs authoritative hero position from gameStore into Main scene.
 */
const PRELOAD_COMPLETE_KEY = "onPreloadComplete";

export default function GameCanvas({ className, children }: Props) {
	const hostRef = useRef<HTMLDivElement>(null);
	const gameRef = useRef<Phaser.Game | null>(null);
	const [showLoadingOverlay, setShowLoadingOverlay] = useState(true);
	const setGameRef = useMapStore((s) => s.setGameRef);
	const hero = useGameStore((s) => s.hero);

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

	// When server state updates hero, push idx into Main scene (no-op if scene not ready). Scene converts idx to pixels.
	useEffect(() => {
		const game = useMapStore.getState().gameRef;
		const mainScene = game?.scene?.getScene("Main") as MainSceneWithHero | undefined;
		mainScene?.setHeroPosition?.(hero.idx);
	}, [hero.idx]);

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
