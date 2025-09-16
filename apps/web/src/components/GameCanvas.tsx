import { useEffect, useRef } from "react";
import type Phaser from "phaser";
import { createGame } from "../game/createGame";

type Props = {
	className?: string;
	children?: React.ReactNode;
};

export default function GameCanvas({ className, children }: Props) {
	const hostRef = useRef<HTMLDivElement>(null);
	const gameRef = useRef<Phaser.Game | null>(null);

	useEffect(() => {
		if (!hostRef.current || gameRef.current) return;
		gameRef.current = createGame(hostRef.current);
		return () => {
			gameRef.current?.destroy(true);
			gameRef.current = null;
		};
	}, []);

	return (
		<div
			className={[
				"relative w-full h-full overflow-hidden bg-slate-950",
				className || "",
			].join(" ")}
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
