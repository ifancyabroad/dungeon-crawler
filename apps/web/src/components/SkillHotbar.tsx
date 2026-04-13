/**
 * SkillHotbar — shows the hero's active skills with cooldown overlays.
 * Clicking a skill with targetType "none" fires immediately;
 * "tile" or "actor" skills enter targeting mode in Phaser.
 *
 * During targeting mode:
 *   - The active skill shows a × badge and clicking it cancels targeting.
 *   - All other skills are disabled and non-interactive.
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
import { rankRoman } from "../lib/rankRoman";
import { SkillIcon } from "./SkillIcon";
import { Tooltip } from "./Tooltip";
import { SkillTooltip } from "./SkillTooltip";
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
 * All flat tile indices on the 4 cardinal lines from `heroIdx` within `range`.
 * Each line stops at the first wall tile (inclusive stop — wall tile not included).
 * Used to compute the potential target area for charge-type skills.
 */
function tilesInCardinalLines(
	heroIdx: number,
	width: number,
	height: number,
	range: number,
	opacityMask: Uint8Array | null,
): number[] {
	const { x: hx, y: hy } = idxToXY(heroIdx, width);
	const result: number[] = [];
	const directions = [
		[0, -1],
		[0, 1],
		[-1, 0],
		[1, 0],
	] as const;
	for (const [ddx, ddy] of directions) {
		for (let dist = 1; dist <= range; dist++) {
			const nx = hx + ddx * dist;
			const ny = hy + ddy * dist;
			if (nx < 0 || nx >= width || ny < 0 || ny >= height) break;
			const idx = ny * width + nx;
			if (opacityMask && opacityMask[idx] === 1) break;
			result.push(idx);
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
	const exitTargeting = useTargetingStore((s) => s.exitTargeting);
	const isTargeting = useTargetingStore((s) => s.active);
	const activeSkillDef = useTargetingStore((s) => s.skillDef);
	const opacityMask = useMapStore((s) => s.opacityMask);

	if (!state) return null;

	const hero = getHero(state);
	if (!hero || !hero.alive || Object.keys(hero.skills).length === 0) return null;

	const floor = state.floors[state.heroFloorIndex];
	function handleSkillClick(skillId: string) {
		if (!hero || !floor) return;

		// In targeting mode, clicking the active skill cancels; all others are blocked.
		if (isTargeting) {
			if (activeSkillDef?.id === skillId) exitTargeting();
			return;
		}

		if (!hero.armorProficient) return;
		const skillDef = skillsById[skillId as keyof typeof skillsById];
		if (!skillDef || skillDef.skillType !== "active") return;

		const activeDef = skillDef as ActiveSkillDefinition;

		const skillState = hero.skills[skillId];
		if (!skillState || skillState.cooldownRemaining > 0) return;
		if (skillState.floorUsesRemaining !== undefined && skillState.floorUsesRemaining <= 0)
			return;

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
			// For tile skills, potential area equals the valid targets.
			enterTargeting(activeDef, validTileIndices, [], skillState.rank, validTileIndices);
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

			// Potential area: cardinal lines for charge, full Chebyshev range for others.
			const rawPotential = hasCharge
				? tilesInCardinalLines(hero.idx, fw, fh, range, opacityMask ?? null)
				: tilesInRange(hero.idx, fw, fh, range);
			const potentialTileIndices = rawPotential.filter((idx) => {
				if (visibilityMask && visibilityMask[idx] !== 1) return false;
				if (opacityMask && opacityMask[idx] === 1) return false;
				return true;
			});

			enterTargeting(activeDef, [], validActorIds, skillState.rank, potentialTileIndices);
		}
	}

	// Only show active skills in the hotbar; passive skills are displayed in the sidebar.
	const skillEntries = Object.entries(hero.skills).filter(([skillId]) => {
		const def = skillsById[skillId as keyof typeof skillsById];
		return def?.skillType === "active";
	});

	if (skillEntries.length === 0) return null;

	const armorLocked = !hero.armorProficient;

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
				if (!skillDef) return null;

				const isActiveTargetSkill = isTargeting && activeSkillDef?.id === skillId;
				const isOtherDuringTargeting = isTargeting && !isActiveTargetSkill;

				const onCooldown = skillState.cooldownRemaining > 0;
				const floorExhausted =
					skillState.floorUsesRemaining !== undefined &&
					skillState.floorUsesRemaining <= 0;
				// During targeting, only the active skill is interactive.
				const disabled =
					isOtherDuringTargeting ||
					(!isTargeting && (onCooldown || floorExhausted || armorLocked));
				const displayName = skillDef?.name ?? skillId;
				const rankGlyph = rankRoman(skillState.rank);
				const ariaLabel = isActiveTargetSkill
					? `${displayName} ${rankGlyph}, targeting active — click to cancel`
					: armorLocked
						? `${displayName} ${rankGlyph}, unavailable (not proficient with equipped armor)`
						: onCooldown
							? `${displayName} ${rankGlyph}, ${skillState.cooldownRemaining} turns cooldown`
							: floorExhausted
								? `${displayName} ${rankGlyph}, used this floor`
								: `${displayName} ${rankGlyph}, ready`;
				return (
					<Tooltip
						key={skillId}
						content={
							<SkillTooltip
								def={skillDef}
								rank={skillState.rank}
								cooldownRemaining={skillState.cooldownRemaining}
								floorUsesRemaining={skillState.floorUsesRemaining}
								armorLocked={armorLocked}
							/>
						}
					>
						<button
							type="button"
							aria-disabled={disabled}
							aria-label={ariaLabel}
							onClick={() => {
								if (disabled) return;
								handleSkillClick(skillId);
							}}
							className={[
								"relative flex-none border transition-colors w-14 h-14",
								disabled
									? "border-border cursor-not-allowed"
									: "border-border-bright hover:bg-bg-elevated cursor-pointer",
							].join(" ")}
						>
							<SkillIcon
								def={skillDef}
								size={48}
								className={[
									"absolute inset-0 m-auto",
									armorLocked || isOtherDuringTargeting || floorExhausted
										? "opacity-40"
										: "",
								].join(" ")}
							/>
							{onCooldown && skillDef && skillDef.cooldown > 0 && !isTargeting && (
								<div
									aria-hidden
									className="pointer-events-none absolute inset-0 -rotate-90"
									style={{
										background: `conic-gradient(rgba(0,0,0,0.72) 0turn, rgba(0,0,0,0.72) ${skillState.cooldownRemaining / skillDef.cooldown}turn, transparent ${skillState.cooldownRemaining / skillDef.cooldown}turn)`,
									}}
								/>
							)}
							{onCooldown && !isTargeting && (
								<span
									aria-hidden
									className="pointer-events-none absolute inset-0 flex items-center justify-center tabular-nums text-text-bright text-base leading-none"
								>
									{skillState.cooldownRemaining}
								</span>
							)}
							{/* Rank glyph — top right */}
							<span
								aria-hidden
								className="pointer-events-none absolute top-0 right-0 px-0.5 text-primary text-xs leading-none bg-bg-base/80"
							>
								{rankGlyph}
							</span>
							{/* Cancel badge — bottom left, shown only for the active targeting skill */}
							{isActiveTargetSkill && (
								<span
									aria-hidden
									className="pointer-events-none absolute bottom-0 left-0 px-0.5 text-text-bright text-xs leading-none bg-bg-base/80"
								>
									×
								</span>
							)}
						</button>
					</Tooltip>
				);
			})}
		</div>
	);
}
