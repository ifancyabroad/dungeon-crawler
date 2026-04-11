import { useEffect, useMemo, useRef } from "react";
import { skillsById } from "@app/content";
import { useGameStore } from "../features/game/gameStore";
import type { GameEvent } from "@app/shared";

const SKILL_NAMES: Record<string, string> = Object.fromEntries(
	Object.values(skillsById).map((s) => [s.id, s.name]),
);

function damageBreakdown(packets: { damageType: string; effectiveAmount: number }[]): string {
	if (packets.length <= 1) return "";
	return ` (${packets.map((p) => `${capitalize(p.damageType)}:${p.effectiveAmount}`).join(", ")})`;
}

function formatEvent(event: GameEvent, actorNames: Record<string, string>): string {
	// subject: nominative ("You" / "Giant Beetle"), target: objective ("you" / "Giant Beetle")
	const subject = (id: string) => (id === "hero" ? "You" : (actorNames[id] ?? id));
	const target = (id: string) => (id === "hero" ? "you" : (actorNames[id] ?? id));
	const skill = (id: string) => SKILL_NAMES[id] ?? id;

	if (event.type === "attack") {
		const { attackerId, defenderId, result } = event;
		const crit = result.critical ? "[CRIT] " : "";
		const breakdown = damageBreakdown(result.damagePackets);
		if (!result.hit) {
			if (attackerId === "hero")
				return `You missed ${target(defenderId)}. (${result.naturalRoll}+${result.totalAttackRoll - result.naturalRoll}=${result.totalAttackRoll} vs AC ${result.targetAc})`;
			return `${subject(attackerId)} missed ${target(defenderId)}. (Rolled ${result.naturalRoll})`;
		}
		if (attackerId === "hero")
			return `${crit}You hit ${target(defenderId)} for ${result.damage} dmg.${breakdown} (Rolled ${result.naturalRoll})`;
		return `${crit}${subject(attackerId)} hit ${target(defenderId)} for ${result.damage} dmg.${breakdown} (Rolled ${result.naturalRoll})`;
	}

	if (event.type === "death") {
		if (event.actorId === "hero") return "You have been slain!";
		return `${subject(event.actorId)} has been slain!`;
	}

	if (event.type === "skill_miss") {
		const attacker = event.attackerId === "hero" ? "Your" : `${subject(event.attackerId)}'s`;
		const rollBreakdown =
			event.attackerId === "hero"
				? ` (${event.naturalRoll}+${event.totalRoll - event.naturalRoll}=${event.totalRoll} vs AC ${event.targetAc})`
				: ` (Rolled ${event.naturalRoll})`;
		return `${attacker} ${skill(event.skillId)} misses ${target(event.defenderId)}.${rollBreakdown}`;
	}

	if (event.type === "skill_hit") {
		const crit = event.result.critical ? "[CRIT] " : "";
		const breakdown = damageBreakdown(event.result.damagePackets);
		return `${crit}${skill(event.skillId)} hits ${target(event.defenderId)} for ${event.result.damage} dmg${breakdown}.`;
	}

	if (event.type === "area_hit") {
		const breakdown = damageBreakdown(event.damagePackets);
		return `${skill(event.skillId)} hits ${target(event.defenderId)} for ${event.damage} dmg${breakdown}.`;
	}

	if (event.type === "skill_used") {
		if (event.actorId === "hero") return `You use ${skill(event.skillId)}!`;
		return `${subject(event.actorId)} uses ${skill(event.skillId)}!`;
	}

	if (event.type === "status_applied") {
		// Status IDs (e.g. "poisoned", "berserk") have no content name entry — format the ID.
		const statusName = formatIdAsWords(event.statusId);
		if (event.actorId === "hero") {
			return event.durationTurns > 0
				? `You gain ${statusName} for ${event.durationTurns} turns.`
				: `You gain ${statusName}.`;
		}
		return event.durationTurns > 0
			? `${subject(event.actorId)} is afflicted with ${statusName} for ${event.durationTurns} turns.`
			: `${subject(event.actorId)} is afflicted with ${statusName}.`;
	}

	if (event.type === "shield_absorbed") {
		if (event.actorId !== "hero") return "";
		return `Shield absorbs ${event.absorbed} damage. (${event.shieldHpRemaining} remaining)`;
	}

	if (event.type === "dot_damage") {
		const statusName = formatIdAsWords(event.statusId);
		if (event.actorId === "hero") return `${statusName} deals ${event.damage} damage to you.`;
		return `${subject(event.actorId)} takes ${event.damage} ${statusName.toLowerCase()} damage.`;
	}

	if (event.type === "saving_throw") {
		const autoPrefix =
			event.auto === "auto_success"
				? "[AUTO20] "
				: event.auto === "auto_fail"
					? "[AUTO1] "
					: "";
		const outcome = event.success ? "succeeded" : "failed";
		const dc = `(${event.totalRoll} vs DC ${event.dc})`;
		if (event.defenderId === "hero")
			return `${autoPrefix}Your ${capitalize(event.saveAbility)} save ${outcome} ${dc}.`;
		return `${autoPrefix}${subject(event.defenderId)}'s ${capitalize(event.saveAbility)} save ${outcome} ${dc}.`;
	}

	return "";
}

/** "arcane_surge" → "Arcane Surge". Used for status IDs which have no content name entry. */
function formatIdAsWords(id: string): string {
	return id
		.split("_")
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ");
}

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

function eventColorClass(event: GameEvent): string {
	if (event.type === "death") return event.actorId === "hero" ? "text-death" : "text-kill";
	if (event.type === "attack" && event.result.critical) return "text-primary";
	if (event.type === "attack" && event.attackerId === "hero") return "text-text-bright";
	if (event.type === "skill_miss") return "text-text-muted";
	if (event.type === "skill_hit" && event.result.critical) return "text-primary";
	if (event.type === "skill_hit") return "text-text-bright";
	if (event.type === "area_hit") return "text-primary";
	if (event.type === "skill_used") return "text-primary";
	if (event.type === "status_applied") return "text-secondary";
	if (event.type === "shield_absorbed") return "text-sky-400";
	if (event.type === "dot_damage") return "text-green-500";
	if (event.type === "saving_throw") return event.success ? "text-primary" : "text-text-muted";
	return "text-text";
}

// Fixed line-height so container height is always an exact multiple — no partial lines.
const LINE_HEIGHT = 24; // px, matches leading-6
const VISIBLE_LINES = 5;
const LOG_HEIGHT = LINE_HEIGHT * VISIBLE_LINES;

export function CombatLog() {
	const combatLog = useGameStore((s) => s.combatLog);
	const state = useGameStore((s) => s.state);
	const scrollRef = useRef<HTMLDivElement>(null);

	const actorNames = useMemo(() => {
		if (!state) return {} as Record<string, string>;
		const map: Record<string, string> = {};
		for (const floor of state.floors) {
			for (const actor of Object.values(floor.state.actorsById)) {
				map[actor.id] = actor.name;
			}
		}
		return map;
	}, [state]);

	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [combatLog.length]);

	return (
		<div className="shrink-0 bg-transparent">
			<div
				ref={scrollRef}
				className="overflow-y-auto px-3 py-0"
				style={{ height: LOG_HEIGHT, lineHeight: `${LINE_HEIGHT}px` }}
			>
				{combatLog.length === 0 && (
					<>
						<p className="text-text-bright" style={{ lineHeight: `${LINE_HEIGHT}px` }}>
							&gt; Welcome, adventurer. The dungeon awaits.
						</p>
						<p className="text-text-muted" style={{ lineHeight: `${LINE_HEIGHT}px` }}>
							&gt; Move with WASD or arrow keys.
						</p>
					</>
				)}
				{combatLog.map((event, i) => {
					const text = formatEvent(event, actorNames);
					if (!text) return null;
					return (
						<p
							key={i}
							className={eventColorClass(event)}
							style={{ lineHeight: `${LINE_HEIGHT}px` }}
						>
							&gt; {text}
						</p>
					);
				})}
			</div>
		</div>
	);
}
