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
import { rankRoman } from "../lib/rankRoman";
import { SkillIcon } from "./SkillIcon";
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
		if (!hero.armorProficient) return;
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
				const onCooldown = skillState.cooldownRemaining > 0;
				const disabled = onCooldown || armorLocked;
				const displayName = skillDef?.name ?? skillId;
				const rankGlyph = rankRoman(skillState.rank);
				const ariaLabel = armorLocked
					? `${displayName} ${rankGlyph}, unavailable (not proficient with equipped armor)`
					: onCooldown
						? `${displayName} ${rankGlyph}, ${skillState.cooldownRemaining} turns cooldown`
						: `${displayName} ${rankGlyph}, ready`;
				const infoTooltip = skillDef
					? `${skillDef.name}\n\n${skillDef.description}`
					: skillId;

				return (
					<button
						key={skillId}
						type="button"
						aria-disabled={disabled}
						aria-label={ariaLabel}
						title={infoTooltip}
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
								armorLocked ? "opacity-40" : "",
							].join(" ")}
						/>
						{onCooldown && skillDef && skillDef.cooldown > 0 && (
							<div
								aria-hidden
								className="pointer-events-none absolute inset-0 -rotate-90"
								style={{
									background: `conic-gradient(rgba(0,0,0,0.72) 0turn, rgba(0,0,0,0.72) ${skillState.cooldownRemaining / skillDef.cooldown}turn, transparent ${skillState.cooldownRemaining / skillDef.cooldown}turn)`,
								}}
							/>
						)}
						{onCooldown && (
							<span
								aria-hidden
								className="pointer-events-none absolute inset-0 flex items-center justify-center tabular-nums text-text-bright text-base leading-none"
							>
								{skillState.cooldownRemaining}
							</span>
						)}
						<span
							aria-hidden
							className="pointer-events-none absolute top-0 right-0 px-0.5 text-primary text-xs leading-none bg-bg-base/80"
						>
							{rankGlyph}
						</span>
					</button>
				);
			})}
		</div>
	);
}
