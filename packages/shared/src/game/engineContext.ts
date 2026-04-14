import type { FloorState, GameEvent, GameState } from "./types";
import type { SkillDefinition } from "../skills";
import type { AffixDef, ItemDef } from "../items/types";

/** Class skill pools passed via context for deterministic offer generation. */
export interface ClassSkillPools {
	activeSkillPool: string[];
	passiveSkillPool: string[];
}

/** Empty floor state. Use when defaulting or building from persisted. spawnIdx and exitIdx are set after map generation. */
export function createEmptyFloorState(): FloorState {
	return {
		tileOverrides: {},
		actorsById: {},
		explored: [],
		spawnIdx: 0,
		exitIdx: null,
		lootByIdx: {},
		chestsByIdx: {},
		openedChestsByIdx: {},
	};
}

/** Context required for applyAction: walkability + opacity masks per floor, plus content lookups. */
export interface ApplyActionContext {
	getWalkableMask(floorIndex: number): Uint8Array;
	/** 1 = opaque (blocks LoS), 0 = transparent. Required for explored-state updates. */
	getOpacityMask(floorIndex: number): Uint8Array;
	/**
	 * Look up a skill definition by id. Used by the "use_skill" and "select_skill_choice" branches.
	 * Returns undefined if the skill is not found (invalid id → engine rejects the action).
	 * In production, this is backed by skillsById from @app/content.
	 * In tests, pass a map of mock definitions.
	 */
	getSkillDef(skillId: string): SkillDefinition | undefined;
	/**
	 * Returns the active/passive skill pools for a given class id.
	 * Used to generate deterministic level-up offers.
	 * Returns undefined if the class is not found.
	 */
	getClassSkillPools(classId: string): ClassSkillPools | undefined;
	/**
	 * All item definitions keyed by id. Used by pickup_item to re-apply equipment.
	 * Optional; if absent, pickup_item is rejected.
	 */
	itemsById?: Record<string, ItemDef>;
	/**
	 * All affix definitions keyed by id. Used for loot generation on NPC death.
	 * Optional; if absent, no loot is generated.
	 */
	affixesById?: Record<string, AffixDef>;
}

/** Build context from precomputed walkability and opacity masks (O(1) per apply). */
export function createActionContext(
	walkableMasks: Uint8Array[],
	opacityMasks: Uint8Array[],
	skillDefs?: Record<string, SkillDefinition>,
	classSkillPools?: Record<string, ClassSkillPools>,
	itemsById?: Record<string, ItemDef>,
	affixesById?: Record<string, AffixDef>,
): ApplyActionContext {
	return {
		getWalkableMask(fi: number): Uint8Array {
			const mask = walkableMasks[fi];
			if (mask === undefined) {
				throw new Error(`createActionContext: missing walkability mask for floor ${fi}`);
			}
			return mask;
		},
		getOpacityMask(fi: number): Uint8Array {
			const mask = opacityMasks[fi];
			if (mask === undefined) {
				throw new Error(`createActionContext: missing opacity mask for floor ${fi}`);
			}
			return mask;
		},
		getSkillDef(skillId: string): SkillDefinition | undefined {
			return skillDefs?.[skillId];
		},
		getClassSkillPools(classId: string): ClassSkillPools | undefined {
			return classSkillPools?.[classId];
		},
		itemsById,
		affixesById,
	};
}

export type ApplyActionResult =
	| { ok: true; state: GameState; events: GameEvent[] }
	| { ok: false; reason: string };
