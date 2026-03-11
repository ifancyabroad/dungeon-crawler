import { useEffect, useRef } from "react";
import { useGameStore } from "../features/game/gameStore";
import type { GameEvent } from "@app/shared";

function formatEvent(event: GameEvent): string {
	if (event.type === "attack") {
		const { attackerId, defenderId, result } = event;
		const attacker =
			attackerId === "hero" ? "You" : capitalize(attackerId.replace(/_\d+$/, ""));
		const defender =
			defenderId === "hero" ? "you" : capitalize(defenderId.replace(/_\d+$/, ""));

		if (!result.hit) {
			if (attackerId === "hero") {
				return `You missed ${defender}. (Rolled ${result.naturalRoll} + ${result.totalAttackRoll - result.naturalRoll} = ${result.totalAttackRoll} vs AC ${result.targetAc})`;
			}
			return `${attacker} missed ${defender}. (Rolled ${result.naturalRoll})`;
		}
		const critLabel = result.critical ? "Critical hit! " : "";
		if (attackerId === "hero") {
			return `${critLabel}You hit ${defender} for ${result.damage} damage. (Rolled ${result.naturalRoll})`;
		}
		return `${critLabel}${attacker} hit ${defender} for ${result.damage} damage. (Rolled ${result.naturalRoll})`;
	}

	if (event.type === "death") {
		const actor =
			event.actorId === "hero" ? "You" : capitalize(event.actorId.replace(/_\d+$/, ""));
		if (event.actorId === "hero") return `${actor} have been slain!`;
		return `${actor} has been slain!`;
	}

	return "";
}

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

export function CombatLog() {
	const combatLog = useGameStore((s) => s.combatLog);
	const scrollRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [combatLog.length]);

	return (
		<div
			ref={scrollRef}
			className="h-32 shrink-0 overflow-y-auto border-t border-border bg-bg-surface px-4 py-2 text-sm font-mono"
		>
			{combatLog.length === 0 && (
				<p className="text-text-muted/50 italic">No combat events yet.</p>
			)}
			{combatLog.map((event, i) => {
				const text = formatEvent(event);
				if (!text) return null;
				const isHeroDeath = event.type === "death" && event.actorId === "hero";
				const isEnemyDeath = event.type === "death" && event.actorId !== "hero";
				return (
					<p
						key={i}
						className={
							isHeroDeath
								? "text-red-400"
								: isEnemyDeath
									? "text-green-400"
									: "text-text-muted"
						}
					>
						{text}
					</p>
				);
			})}
		</div>
	);
}
