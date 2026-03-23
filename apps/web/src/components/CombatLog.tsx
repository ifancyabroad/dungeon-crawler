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
				return `You missed ${defender}. (${result.naturalRoll}+${result.totalAttackRoll - result.naturalRoll}=${result.totalAttackRoll} vs AC ${result.targetAc})`;
			}
			return `${attacker} missed ${defender}. (Rolled ${result.naturalRoll})`;
		}
		const critLabel = result.critical ? "[CRIT] " : "";
		const breakdown =
			result.damagePackets.length > 1
				? ` (${result.damagePackets
						.map((p) => `${capitalize(p.damageType)}:${p.effectiveAmount}`)
						.join(", ")})`
				: "";
		if (attackerId === "hero") {
			return `${critLabel}You hit ${defender} for ${result.damage} dmg.${breakdown} (Rolled ${result.naturalRoll})`;
		}
		return `${critLabel}${attacker} hit ${defender} for ${result.damage} dmg.${breakdown} (Rolled ${result.naturalRoll})`;
	}

	if (event.type === "death") {
		const actor =
			event.actorId === "hero" ? "You" : capitalize(event.actorId.replace(/_\d+$/, ""));
		if (event.actorId === "hero") return `${actor} have been slain!`;
		return `${actor} has been slain!`;
	}

	if (event.type === "skill_miss") {
		const skillName = formatSkillId(event.skillId);
		const attacker =
			event.attackerId === "hero"
				? "Your"
				: `${capitalize(event.attackerId.replace(/_\d+$/, ""))}'s`;
		const defender =
			event.defenderId === "hero" ? "you" : capitalize(event.defenderId.replace(/_\d+$/, ""));
		const rollBreakdown =
			event.attackerId === "hero"
				? ` (${event.naturalRoll}+${event.totalRoll - event.naturalRoll}=${event.totalRoll} vs AC ${event.targetAc})`
				: ` (Rolled ${event.naturalRoll})`;
		return `${attacker} ${skillName} misses ${defender}.${rollBreakdown}`;
	}

	if (event.type === "skill_hit") {
		const skillName = formatSkillId(event.skillId);
		const defender =
			event.defenderId === "hero" ? "you" : capitalize(event.defenderId.replace(/_\d+$/, ""));
		const critLabel = event.result.critical ? "[CRIT] " : "";
		const breakdown =
			event.result.damagePackets.length > 1
				? ` (${event.result.damagePackets
						.map((p) => `${capitalize(p.damageType)}:${p.effectiveAmount}`)
						.join(", ")})`
				: "";
		return `${critLabel}${skillName} hits ${defender} for ${event.result.damage} dmg${breakdown}.`;
	}

	if (event.type === "area_hit") {
		const skillName = formatSkillId(event.skillId);
		const defender =
			event.defenderId === "hero" ? "you" : capitalize(event.defenderId.replace(/_\d+$/, ""));
		const breakdown =
			event.damagePackets.length > 1
				? ` (${event.damagePackets
						.map((p) => `${capitalize(p.damageType)}:${p.effectiveAmount}`)
						.join(", ")})`
				: "";
		return `${skillName} hits ${defender} for ${event.damage} dmg${breakdown}.`;
	}

	if (event.type === "skill_used") {
		if (event.actorId === "hero") return `You use ${formatSkillId(event.skillId)}!`;
		const caster = capitalize(event.actorId.replace(/_\d+$/, ""));
		return `${caster} uses ${formatSkillId(event.skillId)}!`;
	}

	if (event.type === "status_applied") {
		const name = formatSkillId(event.statusId);
		if (event.actorId === "hero") {
			return event.durationTurns > 0
				? `You gain ${name} for ${event.durationTurns} turns.`
				: `You gain ${name}.`;
		}
		const actor = capitalize(event.actorId.replace(/_\d+$/, ""));
		return event.durationTurns > 0
			? `${actor} is afflicted with ${name} for ${event.durationTurns} turns.`
			: `${actor} is afflicted with ${name}.`;
	}

	if (event.type === "shield_absorbed") {
		if (event.actorId === "hero") {
			return `Shield absorbs ${event.absorbed} damage. (${event.shieldHpRemaining} remaining)`;
		}
		return "";
	}

	if (event.type === "dot_damage") {
		const statusName = formatSkillId(event.statusId);
		if (event.actorId === "hero") {
			return `${statusName} deals ${event.damage} damage to you.`;
		}
		const actor = capitalize(event.actorId.replace(/_\d+$/, ""));
		return `${actor} takes ${event.damage} ${statusName.toLowerCase()} damage.`;
	}

	if (event.type === "saving_throw") {
		const defender =
			event.defenderId === "hero" ? "you" : capitalize(event.defenderId.replace(/_\d+$/, ""));
		const autoPrefix =
			event.auto === "auto_success"
				? "[AUTO20] "
				: event.auto === "auto_fail"
					? "[AUTO1] "
					: "";

		const outcome = event.success ? "succeeded" : "failed";
		const dcLabel = `(${event.totalRoll} vs DC ${event.dc})`;
		return event.defenderId === "hero"
			? `${autoPrefix}Your ${capitalize(event.saveAbility)} save ${outcome} ${dcLabel}.`
			: `${autoPrefix}${defender}'s ${capitalize(event.saveAbility)} save ${outcome} ${dcLabel}.`;
	}

	return "";
}

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "lightning_bolt" → "Lightning Bolt" */
function formatSkillId(id: string): string {
	return id
		.split("_")
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ");
}

function eventColorClass(event: GameEvent): string {
	if (event.type === "death") {
		return event.actorId === "hero" ? "text-death" : "text-kill";
	}
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
	const scrollRef = useRef<HTMLDivElement>(null);

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
					const text = formatEvent(event);
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
