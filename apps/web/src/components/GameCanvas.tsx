import { useEffect, useRef } from "react";
import type Phaser from "phaser";
import { createGame, type GameSize } from "../game/createGame";

type Props = {
	width?: number;
	height?: number;
	children?: React.ReactNode;
	className?: string;
};

export default function GameCanvas({ width = 800, height = 600, children, className }: Props) {
	const hostRef = useRef<HTMLDivElement>(null);
	const gameRef = useRef<Phaser.Game | null>(null);

	useEffect(() => {
		if (!hostRef.current || gameRef.current) return;
		gameRef.current = createGame(hostRef.current, { width, height } as GameSize);
		return () => {
			gameRef.current?.destroy(true);
			gameRef.current = null;
		};
	}, [width, height]);

	return (
		<div
			className={`relative rounded-xl overflow-hidden ring-1 ring-slate-800 bg-slate-950 ${className ?? ""}`}
			style={{ width, height }}
		>
			<div ref={hostRef} className="absolute inset-0" />

			{children ? (
				<div className="absolute top-4 left-4 pointer-events-none">
					<div className="pointer-events-auto">{children}</div>
				</div>
			) : null}
		</div>
	);
}
