/**
 * Targeting mode store.
 *
 * When a player clicks a skill with targetType "tile" or "actor", the UI enters
 * targeting mode. Phaser renders a targeting overlay and the player selects a
 * target by clicking. On confirmation the skill action is dispatched via gameStore.
 */

import { create } from "zustand";
import type { ActiveSkillDefinition } from "@app/content";

interface TargetingState {
	/** Whether targeting mode is active. */
	active: boolean;
	/** The active skill being targeted. Null when inactive. Passive skills cannot be targeted. */
	skillDef: ActiveSkillDefinition | null;
	/** Hero's current rank for this skill (1–3). Drives effectsByRank index for AoE preview. */
	skillRank: number;
	/**
	 * For "tile" targetType: flat tile indices the player may select (within skill range
	 * relative to hero position). Computed by the UI on enter.
	 */
	validTileIndices: number[];
	/**
	 * For "actor" targetType: actor ids the player may select.
	 * Only living enemies in a straight line within skill range are included.
	 */
	validActorIds: string[];
	/**
	 * Tile indices currently in the AoE preview (hovered tile ± radiusTiles).
	 * Updated on pointer hover in the Phaser scene.
	 */
	aoePreviewIndices: number[];
}

interface TargetingActions {
	/** Enter targeting mode for an active skill. Provides pre-computed valid targets. */
	enterTargeting: (
		skillDef: ActiveSkillDefinition,
		validTileIndices: number[],
		validActorIds: string[],
		skillRank?: number,
	) => void;
	/** Exit targeting mode without firing (e.g. Escape key). */
	exitTargeting: () => void;
	/** Update the AoE preview on pointer hover. */
	setAoePreview: (indices: number[]) => void;
}

export type TargetingStore = TargetingState & TargetingActions;

const emptyState: TargetingState = {
	active: false,
	skillDef: null,
	skillRank: 1,
	validTileIndices: [],
	validActorIds: [],
	aoePreviewIndices: [],
};

export const useTargetingStore = create<TargetingStore>((set) => ({
	...emptyState,

	enterTargeting: (skillDef, validTileIndices, validActorIds, skillRank = 1) =>
		set({
			active: true,
			skillDef,
			skillRank,
			validTileIndices,
			validActorIds,
			aoePreviewIndices: [],
		}),

	exitTargeting: () => set(emptyState),

	setAoePreview: (indices) => set({ aoePreviewIndices: indices }),
}));
