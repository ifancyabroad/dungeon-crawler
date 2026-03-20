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
		if (id === "hero" || !actor.alive || actor.def.type !== "monster") continue;

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
			const validTileIndices = allTiles.filter((idx) => {
				// Must be within the hero's current line of sight.
				if (visibilityMask && visibilityMask[idx] !== 1) return false;
				// Wall tiles are never valid targets — the beam stops before them.
				if (opacityMask && opacityMask[idx] === 1) return false;
				return true;
			});
			enterTargeting(activeDef, validTileIndices, []);
			return;
		}

		if (activeDef.targetType === "actor") {
			void fh;
			const allActorIds = actorsInChargeRange(hero, floor.state.actorsById, fw, range);
			const validActorIds = visibilityMask
				? allActorIds.filter((id) => {
						const actor = floor.state.actorsById[id];
						return actor && visibilityMask[actor.idx] === 1;
					})
				: allActorIds;
			enterTargeting(activeDef, [], validActorIds);
		}
	}

	// Only show active skills in the hotbar; passive skills are displayed in the sidebar.
	const skillEntries = Object.entries(hero.skills).filter(([skillId]) => {
		const def = skillsById[skillId as keyof typeof skillsById];
		return def?.skillType === "active";
	});

	if (skillEntries.length === 0) return null;

	return (
		<div className="shrink-0 flex items-center justify-center gap-2 px-3 py-2 border-t border-border bg-bg-base">
			{skillEntries.map(([skillId, skillState]) => {
				const skillDef = skillsById[skillId as keyof typeof skillsById] as
					| ActiveSkillDefinition
					| undefined;
				const onCooldown = skillState.cooldownRemaining > 0;

				return (
					<button
						key={skillId}
						onClick={() => handleSkillClick(skillId)}
						disabled={onCooldown}
						title={skillDef ? `${skillDef.name}: ${skillDef.description}` : skillId}
						className={[
							"relative flex flex-col items-center justify-center",
							"w-16 h-16 border text-xs font-mono transition-colors",
							onCooldown
								? "border-border text-text-muted cursor-not-allowed opacity-50"
								: "border-border-bright text-text-bright hover:bg-bg-elevated cursor-pointer",
						].join(" ")}
					>
						{/* Skill name */}
						<span className="text-center leading-tight px-0.5 truncate w-full text-center">
							{skillDef?.name ?? skillId}
						</span>

						{/* Cooldown overlay */}
						{onCooldown && (
							<span className="absolute inset-0 flex items-center justify-center bg-black/60 text-primary text-base font-bold">
								{skillState.cooldownRemaining}
							</span>
						)}

						{/* Ready indicator */}
						{!onCooldown && (
							<span className="text-secondary text-xs mt-0.5">READY</span>
						)}
					</button>
				);
			})}
		</div>
	);
}
