import type { ClassSkillPools, GameState, PassiveSkillDefinition } from "../index";
import {
	computeOpacityMask,
	computeWalkableMaskForFloor,
	createActionContext,
	createInitialState,
	DEFAULT_FLOOR_CONFIG,
	DEFAULT_HERO_INIT,
	regenerateBaseMaps,
	type ActiveSkillDefinition,
} from "../index";

export const SEED = 42;
export const mockPassiveStrSkill: PassiveSkillDefinition = {
	skillType: "passive",
	id: "passive_str",
	name: "Might",
	description: "+2 Str",
	school: "martial",
	tags: ["buff"],
	effects: [{ type: "modify_attribute", attribute: "strength", amount: 2 }],
};
export const mockPassiveAcSkill: PassiveSkillDefinition = {
	skillType: "passive",
	id: "passive_ac",
	name: "Iron Skin",
	description: "+1 AC",
	school: "martial",
	tags: ["buff"],
	effects: [{ type: "modify_armor_class", amount: 1 }],
};
export const mockPassiveResistance: PassiveSkillDefinition = {
	skillType: "passive",
	id: "passive_fire_resist",
	name: "Fire Resist",
	description: "Fire resistance",
	school: "arcane",
	tags: ["utility"],
	effects: [{ type: "add_damage_resistance", damageType: "fire" }],
};
export const mockPassiveDamageDice: PassiveSkillDefinition = {
	skillType: "passive",
	id: "passive_damage_dice",
	name: "Crushing",
	description: "+1d6 bludgeoning",
	school: "martial",
	tags: ["damage", "buff"],
	effects: [
		{
			type: "add_damage_dice",
			dice: "1d6",
			damageType: "bludgeoning",
			appliesTo: "melee",
			onCritOnly: false,
		},
	],
};
export const mockSkillDefs: Record<string, PassiveSkillDefinition> = {
	passive_str: mockPassiveStrSkill,
	passive_ac: mockPassiveAcSkill,
	passive_fire_resist: mockPassiveResistance,
	passive_damage_dice: mockPassiveDamageDice,
};
export const mockPools: Record<string, ClassSkillPools> = {
	warrior: {
		activeSkillPool: ["active1", "active2", "active3"],
		passiveSkillPool: [
			"passive_str",
			"passive_ac",
			"passive_fire_resist",
			"passive_damage_dice",
		],
	},
};

export function makePendingSkillChoiceState() {
	const state = createInitialState(SEED, [DEFAULT_FLOOR_CONFIG], {
		...DEFAULT_HERO_INIT,
		classId: "warrior",
	});
	return {
		...state,
		pendingInteraction: {
			type: "skill_choice",
			offerType: "passive",
			levelReached: 2,
			offers: ["passive_str", "passive_ac"],
			rerollsUsed: 0,
		},
	} as GameState;
}

export function buildContext(
	state: GameState,
	skillDefs?: Record<string, object>,
	pools?: Record<string, ClassSkillPools>,
) {
	const baseLayers = regenerateBaseMaps(
		state.seed,
		state.floors.map((f) => f.config),
		state.mapGenVersion,
	);
	const walkable = baseLayers.map((base, i) =>
		computeWalkableMaskForFloor(base, state.floors[i]?.state.tileOverrides ?? {}),
	);
	const opacity = baseLayers.map((base) =>
		computeOpacityMask(base.wall, base.width, base.height),
	);
	return createActionContext(
		walkable,
		opacity,
		skillDefs as Record<string, ActiveSkillDefinition>,
		pools,
	);
}
