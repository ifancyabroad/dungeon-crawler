import { describe, expect, it } from "vitest";
import {
	computeSavingThrowDC,
	createEmptyFloorState,
	proficiencyBonusFromChallengeRating,
	proficiencyBonusFromLevel,
	resolveSavingThrow,
	resolveSkill,
	type Actor,
	type ActiveSkillDefinition,
	type Rng,
} from "../index";

function makeRngFromSequence(values: number[]): Rng {
	let idx = 0;
	return (() => values[idx++] ?? 0) as Rng;
}

const ATTRS = {
	strength: 10,
	dexterity: 10,
	constitution: 10,
	intelligence: 10,
	wisdom: 10,
	charisma: 10,
};

const UNARMED_WEAPON_DICE = { dice: "1d4", damageType: "bludgeoning" as const };

function makeHeroActor(overrides?: Partial<Actor>): Actor {
	return {
		id: "hero",
		name: "Hero",
		idx: 0,
		alive: true,
		hp: 10,
		maxHp: 10,
		armorClass: 10,
		attributes: { ...ATTRS },
		damageResistances: [],
		damageImmunities: [],
		damageVulnerabilities: [],
		skills: {},
		activeEffects: [],
		numericBuffs: {},
		passiveDamageBonuses: [],
		passiveFlatDamageBonuses: [],
		statusImmunities: [],
		def: { type: "hero", classId: "warrior" },
		level: 1,
		xp: 0,
		hitDie: 10,
		xpReward: 0,
		savingThrowProficiencies: ["strength", "constitution"],
		equipment: {},
		weaponProficiencies: [],
		armorProficiencies: [],
		equippedWeaponDice: UNARMED_WEAPON_DICE,
		equippedAttackStat: "strength",
		equippedWeaponFinesse: false,
		weaponProficient: false,
		gold: 0,
		itemInstances: {},
		itemAttackBonusFlat: 0,
		itemAcBonus: 0,
		...overrides,
	};
}

function makeNpcActor(overrides?: Partial<Actor>): Actor {
	return {
		id: "npc",
		name: "Npc",
		idx: 1,
		alive: true,
		hp: 10,
		maxHp: 10,
		armorClass: 10,
		attributes: { ...ATTRS },
		damageResistances: [],
		damageImmunities: [],
		damageVulnerabilities: [],
		skills: {},
		activeEffects: [],
		numericBuffs: {},
		passiveDamageBonuses: [],
		passiveFlatDamageBonuses: [],
		statusImmunities: [],
		def: { type: "npc", npcId: "goblin" },
		level: 0,
		xp: 0,
		hitDie: 0,
		xpReward: 30,
		savingThrowProficiencies: ["dexterity"],
		challengeRating: 1,
		equipment: {},
		weaponProficiencies: [],
		armorProficiencies: [],
		equippedWeaponDice: UNARMED_WEAPON_DICE,
		equippedAttackStat: "strength",
		equippedWeaponFinesse: false,
		weaponProficient: false,
		gold: 0,
		itemInstances: {},
		itemAttackBonusFlat: 0,
		itemAcBonus: 0,
		...overrides,
	};
}

describe("saving throw bonus tables", () => {
	it("player level table matches expected bands", () => {
		expect(proficiencyBonusFromLevel(1)).toBe(2);
		expect(proficiencyBonusFromLevel(9)).toBe(4);
		expect(proficiencyBonusFromLevel(17)).toBe(6);
	});
	it("challenge rating table matches expected bands", () => {
		expect(proficiencyBonusFromChallengeRating(1)).toBe(2);
		expect(proficiencyBonusFromChallengeRating(13)).toBe(5);
		expect(proficiencyBonusFromChallengeRating(25)).toBe(8);
	});
});

describe("resolveSavingThrow", () => {
	it("natural 20 always succeeds and natural 1 always fails", () => {
		const defender = makeNpcActor();
		const success = resolveSavingThrow({
			rng: makeRngFromSequence([0.999]),
			defender,
			saveAbility: "dexterity",
			dc: 999,
		});
		const fail = resolveSavingThrow({
			rng: makeRngFromSequence([0]),
			defender,
			saveAbility: "dexterity",
			dc: 0,
		});
		expect(success.success).toBe(true);
		expect(fail.success).toBe(false);
	});
});

describe("area_damage save scaling", () => {
	const skillDef: ActiveSkillDefinition = {
		skillType: "active",
		id: "test_area",
		name: "Test Area",
		description: "Test",
		school: "arcane",
		tags: ["damage", "aoe", "spell"],
		cooldown: 0,
		targetType: "none",
		effectsByRank: [
			[
				{
					type: "area_damage",
					dice: "2d6",
					radiusTiles: 1,
					damageType: "fire",
					savingThrow: {
						saveAbility: "dexterity",
						dcStat: "intelligence",
						successDamageMultiplier: 0.5,
					},
				},
			],
			[
				{
					type: "area_damage",
					dice: "2d6",
					radiusTiles: 1,
					damageType: "fire",
					savingThrow: {
						saveAbility: "dexterity",
						dcStat: "intelligence",
						successDamageMultiplier: 0.5,
					},
				},
			],
			[
				{
					type: "area_damage",
					dice: "2d6",
					radiusTiles: 1,
					damageType: "fire",
					savingThrow: {
						saveAbility: "dexterity",
						dcStat: "intelligence",
						successDamageMultiplier: 0.5,
					},
				},
			],
		],
	};

	it("successful save reduces damage", () => {
		const caster = makeHeroActor({
			id: "caster",
			level: 1,
			attributes: { ...ATTRS, intelligence: 10 },
		});
		const defender = makeNpcActor({
			id: "defender",
			hp: 3,
			savingThrowProficiencies: ["dexterity"],
		});
		const floorState = {
			...createEmptyFloorState(),
			actorsById: { [caster.id]: caster, [defender.id]: defender },
		};
		expect(computeSavingThrowDC(caster, "intelligence")).toBe(10);
		const res = resolveSkill({
			skillDef,
			rank: 1,
			caster,
			casterId: caster.id,
			floorState,
			width: 3,
			height: 3,
			rng: makeRngFromSequence([0, 0, 0.999]),
		});
		if ("error" in res) throw new Error(res.error);
		expect(res.floorState.actorsById[defender.id]!.hp).toBe(2);
	});
});
