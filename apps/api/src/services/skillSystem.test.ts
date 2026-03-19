/**
 * Skill system tests: passive skills, level-up offers, select/reroll actions.
 */
import { describe, it, expect } from "vitest";
import {
	applyAction,
	applyPassiveSkill,
	buildGameStateFromPersisted,
	computeOpacityMask,
	computeWalkableMaskForFloor,
	createActionContext,
	createInitialState,
	DEFAULT_FLOOR_CONFIG,
	DEFAULT_HERO_INIT,
	gameStateToPersisted,
	getHero,
	regenerateBaseMaps,
	type ActiveSkillDefinition,
	type ClassSkillPools,
	type GameState,
	type PassiveSkillDefinition,
} from "@app/shared";

const SEED = 42;

function buildContext(
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

// ---------------------------------------------------------------------------
// Test skill definitions
// ---------------------------------------------------------------------------

const mockPassiveStrSkill: PassiveSkillDefinition = {
	skillType: "passive",
	id: "passive_str",
	name: "Might",
	description: "+2 Str",
	effects: [{ type: "modify_attribute", attribute: "strength", amount: 2 }],
};

const mockPassiveAcSkill: PassiveSkillDefinition = {
	skillType: "passive",
	id: "passive_ac",
	name: "Iron Skin",
	description: "+1 AC",
	effects: [{ type: "modify_armor_class", amount: 1 }],
};

const mockPassiveResistance: PassiveSkillDefinition = {
	skillType: "passive",
	id: "passive_fire_resist",
	name: "Fire Resist",
	description: "Fire resistance",
	effects: [{ type: "add_damage_resistance", damageType: "fire" }],
};

const mockPassiveDamageDice: PassiveSkillDefinition = {
	skillType: "passive",
	id: "passive_damage_dice",
	name: "Crushing",
	description: "+1d6 bludgeoning",
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

const mockSkillDefs: Record<string, PassiveSkillDefinition> = {
	passive_str: mockPassiveStrSkill,
	passive_ac: mockPassiveAcSkill,
	passive_fire_resist: mockPassiveResistance,
	passive_damage_dice: mockPassiveDamageDice,
};

const mockActiveSkillPool = ["active1", "active2", "active3"];
const mockPassiveSkillPool = [
	"passive_str",
	"passive_ac",
	"passive_fire_resist",
	"passive_damage_dice",
];

const mockPools: Record<string, ClassSkillPools> = {
	warrior: { activeSkillPool: mockActiveSkillPool, passiveSkillPool: mockPassiveSkillPool },
};

// ---------------------------------------------------------------------------
// applyPassiveSkill tests
// ---------------------------------------------------------------------------

describe("applyPassiveSkill", () => {
	it("modify_attribute increases the given attribute", () => {
		const state = createInitialState(SEED, [DEFAULT_FLOOR_CONFIG], DEFAULT_HERO_INIT);
		const hero = getHero(state)!;
		const before = hero.attributes.strength;
		const updated = applyPassiveSkill(hero, mockPassiveStrSkill);
		expect(updated.attributes.strength).toBe(before + 2);
	});

	it("modify_armor_class increases armorClass", () => {
		const state = createInitialState(SEED, [DEFAULT_FLOOR_CONFIG], DEFAULT_HERO_INIT);
		const hero = getHero(state)!;
		const before = hero.armorClass;
		const updated = applyPassiveSkill(hero, mockPassiveAcSkill);
		expect(updated.armorClass).toBe(before + 1);
	});

	it("add_damage_resistance pushes to damageResistances", () => {
		const state = createInitialState(SEED, [DEFAULT_FLOOR_CONFIG], DEFAULT_HERO_INIT);
		const hero = getHero(state)!;
		const updated = applyPassiveSkill(hero, mockPassiveResistance);
		expect(updated.damageResistances).toContain("fire");
	});

	it("add_damage_resistance is idempotent when already resists", () => {
		const state = createInitialState(SEED, [DEFAULT_FLOOR_CONFIG], DEFAULT_HERO_INIT);
		const hero = getHero(state)!;
		const once = applyPassiveSkill(hero, mockPassiveResistance);
		const twice = applyPassiveSkill(once, mockPassiveResistance);
		expect(twice.damageResistances.filter((d) => d === "fire")).toHaveLength(1);
	});

	it("add_damage_dice appends to passiveDamageBonuses", () => {
		const state = createInitialState(SEED, [DEFAULT_FLOOR_CONFIG], DEFAULT_HERO_INIT);
		const hero = getHero(state)!;
		const updated = applyPassiveSkill(hero, mockPassiveDamageDice);
		expect(updated.passiveDamageBonuses).toHaveLength(1);
		expect(updated.passiveDamageBonuses[0]!.dice).toBe("1d6");
		expect(updated.passiveDamageBonuses[0]!.damageType).toBe("bludgeoning");
	});

	it("applying multiple effects applies each in order", () => {
		const multiSkill: PassiveSkillDefinition = {
			skillType: "passive",
			id: "multi",
			name: "Multi",
			description: "Str + AC",
			effects: [
				{ type: "modify_attribute", attribute: "strength", amount: 3 },
				{ type: "modify_armor_class", amount: 2 },
			],
		};
		const state = createInitialState(SEED, [DEFAULT_FLOOR_CONFIG], DEFAULT_HERO_INIT);
		const hero = getHero(state)!;
		const updated = applyPassiveSkill(hero, multiSkill);
		expect(updated.attributes.strength).toBe(hero.attributes.strength + 3);
		expect(updated.armorClass).toBe(hero.armorClass + 2);
	});
});

// ---------------------------------------------------------------------------
// Level-up offer generation tests
// ---------------------------------------------------------------------------

describe("select_skill_choice and reroll_skill_choice", () => {
	function makeStateWithPendingInteraction() {
		const state = createInitialState(SEED, [DEFAULT_FLOOR_CONFIG], {
			...DEFAULT_HERO_INIT,
			classId: "warrior",
		});
		// Manually set pendingInteraction to simulate a level-up
		const stateWithInteraction: GameState = {
			...state,
			pendingInteraction: {
				type: "skill_choice",
				offerType: "passive",
				levelReached: 2,
				offers: ["passive_str", "passive_ac"],
				rerollsUsed: 0,
			},
		};
		return stateWithInteraction;
	}

	it("regular actions (move) are blocked when pendingInteraction is set", () => {
		const state = makeStateWithPendingInteraction();
		const ctx = buildContext(state, mockSkillDefs, mockPools);
		const result = applyAction(state, { type: "move", direction: "right" }, ctx);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toBe("interaction_required");
	});

	it("select_skill_choice fails for a skill not in offers", () => {
		const state = makeStateWithPendingInteraction();
		const ctx = buildContext(state, mockSkillDefs, mockPools);
		const result = applyAction(
			state,
			{ type: "select_skill_choice", skillId: "passive_damage_dice" },
			ctx,
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toBe("skill_not_in_offers");
	});

	it("select_skill_choice grants the skill and clears pendingInteraction", () => {
		const state = makeStateWithPendingInteraction();
		const ctx = buildContext(state, mockSkillDefs, mockPools);
		const result = applyAction(
			state,
			{ type: "select_skill_choice", skillId: "passive_str" },
			ctx,
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const hero = getHero(result.state)!;
		expect(hero.skills["passive_str"]).toBeDefined();
		expect(result.state.pendingInteraction).toBeNull();
	});

	it("select_skill_choice applies passive effects to hero", () => {
		const state = makeStateWithPendingInteraction();
		const ctx = buildContext(state, mockSkillDefs, mockPools);
		const heroBeforeStr = getHero(state)!.attributes.strength;
		const result = applyAction(
			state,
			{ type: "select_skill_choice", skillId: "passive_str" },
			ctx,
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const hero = getHero(result.state)!;
		expect(hero.attributes.strength).toBe(heroBeforeStr + 2);
	});

	it("select_skill_choice emits skill_granted event", () => {
		const state = makeStateWithPendingInteraction();
		const ctx = buildContext(state, mockSkillDefs, mockPools);
		const result = applyAction(
			state,
			{ type: "select_skill_choice", skillId: "passive_str" },
			ctx,
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const evt = result.events.find((e) => e.type === "skill_granted");
		expect(evt).toBeDefined();
		if (evt?.type === "skill_granted") expect(evt.skillId).toBe("passive_str");
	});

	it("reroll_skill_choice changes offers and increments rerollsUsed", () => {
		const state = makeStateWithPendingInteraction();
		const ctx = buildContext(state, mockSkillDefs, mockPools);
		const result = applyAction(state, { type: "reroll_skill_choice" }, ctx);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const pi = result.state.pendingInteraction;
		expect(pi?.type).toBe("skill_choice");
		if (pi?.type === "skill_choice") {
			expect(pi.rerollsUsed).toBe(1);
		}
	});

	it("reroll_skill_choice fails when no pendingInteraction", () => {
		const state = createInitialState(SEED, [DEFAULT_FLOOR_CONFIG], DEFAULT_HERO_INIT);
		const ctx = buildContext(state, mockSkillDefs, mockPools);
		const result = applyAction(state, { type: "reroll_skill_choice" }, ctx);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toBe("no_pending_choice");
	});

	it("pendingInteraction survives persisted round-trip", () => {
		const state = makeStateWithPendingInteraction();
		const persisted = gameStateToPersisted(state);
		const restored = buildGameStateFromPersisted(
			state.seed,
			state.mapGenVersion,
			state.floors.map((f) => f.config),
			persisted,
		);
		expect(restored.pendingInteraction).toEqual(state.pendingInteraction);
	});

	it("select_skill_choice advances turn by 1", () => {
		const state = makeStateWithPendingInteraction();
		const ctx = buildContext(state, mockSkillDefs, mockPools);
		const result = applyAction(
			state,
			{ type: "select_skill_choice", skillId: "passive_str" },
			ctx,
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.state.turn).toBe(state.turn + 1);
	});

	it("reroll_skill_choice advances turn by 1", () => {
		const state = makeStateWithPendingInteraction();
		const ctx = buildContext(state, mockSkillDefs, mockPools);
		const result = applyAction(state, { type: "reroll_skill_choice" }, ctx);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.state.turn).toBe(state.turn + 1);
	});
});

// ---------------------------------------------------------------------------
// Determinism test: same seed + same actions → same state
// ---------------------------------------------------------------------------

describe("determinism with skill system", () => {
	it("two independent runs with same seed and select produce identical states", () => {
		function run() {
			const state = createInitialState(SEED, [DEFAULT_FLOOR_CONFIG], {
				...DEFAULT_HERO_INIT,
				classId: "warrior",
			});
			const stateWithInteraction: GameState = {
				...state,
				pendingInteraction: {
					type: "skill_choice",
					offerType: "passive",
					levelReached: 2,
					offers: ["passive_str", "passive_ac"],
					rerollsUsed: 0,
				},
			};
			const ctx = buildContext(stateWithInteraction, mockSkillDefs, mockPools);
			return applyAction(
				stateWithInteraction,
				{ type: "select_skill_choice", skillId: "passive_str" },
				ctx,
			);
		}
		const r1 = run();
		const r2 = run();
		expect(r1.ok).toBe(true);
		expect(r2.ok).toBe(true);
		if (!r1.ok || !r2.ok) return;
		expect(r1.state.rngState).toEqual(r2.state.rngState);
		expect(getHero(r1.state)?.attributes.strength).toBe(getHero(r2.state)?.attributes.strength);
	});
});
