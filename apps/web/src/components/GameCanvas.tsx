import { useEffect, useRef } from "react";
import type Phaser from "phaser";
import { createGame } from "../game/createGame";
import { useMapStore } from "../features/map/mapStore";
import { useGameStore } from "../features/game/gameStore";

type Props = {
	className?: string;
	children?: React.ReactNode;
};

/** Main scene exposes this when running (for server-authoritative hero sync). */
type MainSceneWithHero = Phaser.Scene & { setHeroPosition?(x: number, y: number): void };

/**
 * Hosts the Phaser game canvas (Preload + Main scene).
 * Registers the game instance in mapStore; syncs authoritative hero position from gameStore into Main scene.
 */
export default function GameCanvas({ className, children }: Props) {
	const hostRef = useRef<HTMLDivElement>(null);
	const gameRef = useRef<Phaser.Game | null>(null);
	const setGameRef = useMapStore((s) => s.setGameRef);
	const hero = useGameStore((s) => s.hero);

	// Mount: create Phaser game, register in store. Unmount: destroy and clear.
	useEffect(() => {
		if (!hostRef.current || gameRef.current) return;
		const game = createGame(hostRef.current);
		gameRef.current = game;
		setGameRef(game);
		return () => {
			setGameRef(null);
			gameRef.current?.destroy(true);
			gameRef.current = null;
		};
	}, [setGameRef]);

	// When server state updates hero, push position into Main scene (no-op if scene not ready).
	useEffect(() => {
		const game = useMapStore.getState().gameRef;
		const mainScene = game?.scene?.getScene("Main") as MainSceneWithHero | undefined;
		mainScene?.setHeroPosition?.(hero.x, hero.y);
	}, [hero.x, hero.y]);

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
