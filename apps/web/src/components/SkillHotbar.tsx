/**
 * SkillHotbar — shows the hero's active skills with cooldown overlays.
 * Clicking a skill with targetType "none" fires immediately;
 * "tile" or "actor" skills enter targeting mode in Phaser.
 */

import { skillsById } from "@app/content";
import type { ActiveSkillDefinition } from "@app/content";
import {
	getHero,
	idxToXY,
	computeVisibility,
	VISION_RADIUS,
	type Actor,
	type UseSkillAction,
} from "@app/shared";
import { Info } from "lucide-react";
import { rankRoman } from "../lib/rankRoman";
import { useGameStore } from "../features/game/gameStore";
import { useTargetingStore } from "../features/targeting/targetingStore";
import { useMapStore } from "../features/map/mapStore";

// ---------------------------------------------------------------------------
// Valid-target computation helpers
// ---------------------------------------------------------------------------

/** All flat tile indices within Chebyshev distance `range` of `heroIdx`. */
function tilesInRange(heroIdx: number, width: number, height: number, range: number): number[] {
	const { x: hx, y: hy } = idxToXY(heroIdx, width);
	const result: number[] = [];
	for (let dy = -range; dy <= range; dy++) {
		for (let dx = -range; dx <= range; dx++) {
			if (dx === 0 && dy === 0) continue;
			const nx = hx + dx;
			const ny = hy + dy;
			if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
				result.push(ny * width + nx);
			}
		}
	}
	return result;
}

/**
 * Enemy actor ids that are in a straight cardinal line within maxRange tiles of the hero.
 * Must be at least 2 tiles away (charge requires room to close the gap).
 */
function actorsInChargeRange(
	hero: Actor,
	actors: Record<string, Actor>,
	width: number,
	maxRange: number,
): string[] {
	const { x: hx, y: hy } = idxToXY(hero.idx, width);
	const result: string[] = [];

	for (const [id, actor] of Object.entries(actors)) {
		if (id === "hero" || !actor.alive || actor.def.type !== "npc") continue;

		const { x: ax, y: ay } = idxToXY(actor.idx, width);
		const dx = ax - hx;
		const dy = ay - hy;

		// Must be on the same cardinal axis (not diagonal)
		if (dx !== 0 && dy !== 0) continue;

		const dist = Math.abs(dx) + Math.abs(dy);
		if (dist < 2 || dist > maxRange) continue;

		result.push(id);
	}

	return result;
}

/**
 * Enemy actor ids within Chebyshev distance maxRange of the hero.
 * Used for general actor-targeted skills (magic_arrow, sneak_attack, etc.).
 */
function actorsInRange(
	hero: Actor,
	actors: Record<string, Actor>,
	width: number,
	maxRange: number,
): string[] {
	const { x: hx, y: hy } = idxToXY(hero.idx, width);
	const result: string[] = [];
	for (const [id, actor] of Object.entries(actors)) {
		if (id === "hero" || !actor.alive || actor.def.type !== "npc") continue;
		const { x: ax, y: ay } = idxToXY(actor.idx, width);
		const dist = Math.max(Math.abs(ax - hx), Math.abs(ay - hy));
		if (dist > 0 && dist <= maxRange) result.push(id);
	}
	return result;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SkillHotbar() {
	const state = useGameStore((s) => s.state);
	const sendAction = useGameStore((s) => s.sendAction);
	const enterTargeting = useTargetingStore((s) => s.enterTargeting);
	const opacityMask = useMapStore((s) => s.opacityMask);

	if (!state) return null;

	const hero = getHero(state);
	if (!hero || !hero.alive || Object.keys(hero.skills).length === 0) return null;

	const floor = state.floors[state.heroFloorIndex];
	function handleSkillClick(skillId: string) {
		if (!hero || !floor) return;
		const skillDef = skillsById[skillId as keyof typeof skillsById];
		if (!skillDef || skillDef.skillType !== "active") return;

		const activeDef = skillDef as ActiveSkillDefinition;

		const skillState = hero.skills[skillId];
		if (!skillState || skillState.cooldownRemaining > 0) return;

		if (activeDef.targetType === "none") {
			const action: UseSkillAction = { type: "use_skill", skillId };
			sendAction(action);
			return;
		}

		const range = activeDef.range ?? 4;
		const fw = floor.config.width;
		const fh = floor.config.height;

		// Compute which tiles the hero can currently see so targeting is
		// restricted to line-of-sight. Falls back to no restriction when the
		// opacity mask hasn't been set yet (e.g. on first load).
		const { x: hx, y: hy } = idxToXY(hero.idx, fw);
		const visibilityMask = opacityMask
			? computeVisibility(hx, hy, fw, fh, opacityMask, VISION_RADIUS)
			: null;

		if (activeDef.targetType === "tile") {
			const allTiles = tilesInRange(hero.idx, fw, fh, range);
			const effectsAtRank =
				activeDef.effectsByRank[skillState.rank - 1] ?? activeDef.effectsByRank[0];
			const isLeapSkill = effectsAtRank.some((e) => e.type === "leap_attack");
			const validTileIndices = allTiles.filter((idx) => {
				if (visibilityMask && visibilityMask[idx] !== 1) return false;
				// Wall tiles are never valid targets.
				if (opacityMask && opacityMask[idx] === 1) return false;
				// Leap requires an unoccupied landing tile.
				if (isLeapSkill) {
					const occupied = Object.values(floor.state.actorsById).some(
						(a) => a.alive && a.idx === idx,
					);
					if (occupied) return false;
				}
				return true;
			});
			enterTargeting(activeDef, validTileIndices, [], skillState.rank);
			return;
		}

		if (activeDef.targetType === "actor") {
			void fh;
			// charge uses a strict cardinal-line check; all other actor-targeted
			// skills allow any enemy within Chebyshev range.
			const effectsAtRank =
				activeDef.effectsByRank[skillState.rank - 1] ?? activeDef.effectsByRank[0];
			const hasCharge = effectsAtRank.some((e) => e.type === "charge_attack");
			const allActorIds = hasCharge
				? actorsInChargeRange(hero, floor.state.actorsById, fw, range)
				: actorsInRange(hero, floor.state.actorsById, fw, range);
			const validActorIds = visibilityMask
				? allActorIds.filter((id) => {
						const actor = floor.state.actorsById[id];
						return actor && visibilityMask[actor.idx] === 1;
					})
				: allActorIds;
			enterTargeting(activeDef, [], validActorIds, skillState.rank);
		}
	}

	// Only show active skills in the hotbar; passive skills are displayed in the sidebar.
	const skillEntries = Object.entries(hero.skills).filter(([skillId]) => {
		const def = skillsById[skillId as keyof typeof skillsById];
		return def?.skillType === "active";
	});

	if (skillEntries.length === 0) return null;

	return (
		<div
			className="shrink-0 flex flex-wrap gap-2 justify-start px-3 py-2 border-t border-border bg-bg-base"
			role="toolbar"
			aria-label="Active skills"
		>
			{skillEntries.map(([skillId, skillState]) => {
				const skillDef = skillsById[skillId as keyof typeof skillsById] as
					| ActiveSkillDefinition
					| undefined;
				const onCooldown = skillState.cooldownRemaining > 0;
				const displayName = skillDef?.name ?? skillId;
				const rankGlyph = rankRoman(skillState.rank);
				const ariaLabel = onCooldown
					? `${displayName} ${rankGlyph}, ${skillState.cooldownRemaining} turns cooldown`
					: `${displayName} ${rankGlyph}, ready`;
				const infoTooltip = skillDef
					? `${skillDef.name}\n\n${skillDef.description}`
					: skillId;

				return (
					<button
						key={skillId}
						type="button"
						aria-disabled={onCooldown}
						aria-label={ariaLabel}
						onClick={(e) => {
							const t = e.target;
							if (t instanceof Element && t.closest("[data-skill-info]")) {
								// Reserved: open skill detail modal (tooltip via title on [data-skill-info]).
								return;
							}
							if (onCooldown) return;
							handleSkillClick(skillId);
						}}
						className={[
							"relative flex w-56 flex-none items-stretch gap-2 border px-2 py-2 text-left text-base leading-snug transition-colors",
							onCooldown
								? "border-border"
								: "border-border-bright hover:bg-bg-elevated",
						].join(" ")}
					>
						<span
							data-skill-info
							className="shrink-0 cursor-pointer self-center text-text-muted transition-colors hover:text-text-bright"
							title={infoTooltip}
						>
							<Info className="block" size={16} aria-hidden />
						</span>
						<span
							className={[
								"relative flex min-w-0 flex-1 items-stretch gap-2",
								onCooldown
									? "cursor-not-allowed text-text-muted"
									: "cursor-pointer text-text-bright",
							].join(" ")}
						>
							{onCooldown && (
								<span
									className="pointer-events-none absolute inset-0 z-10 bg-black/50"
									aria-hidden
								/>
							)}
							<span className="relative z-0 min-w-0 flex-1 line-clamp-2 wrap-break-word self-center">
								<span
									className={onCooldown ? "text-text-muted" : "text-text-bright"}
								>
									{displayName}
								</span>
								<span className="text-primary"> {rankGlyph}</span>
							</span>
							<span className="relative z-0 flex w-9 shrink-0 flex-col items-center justify-center">
								{onCooldown ? (
									<span className="text-base tabular-nums text-primary">
										{skillState.cooldownRemaining}
									</span>
								) : (
									<span className="text-base text-success">Ready</span>
								)}
							</span>
						</span>
					</button>
				);
			})}
		</div>
	);
}
