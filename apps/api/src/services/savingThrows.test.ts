import { describe, it, expect } from "vitest";
import type { Actor } from "@app/shared";
import {
	computeSavingThrowDC,
	createEmptyFloorState,
	proficiencyBonusFromChallengeRating,
	proficiencyBonusFromLevel,
	resolveSavingThrow,
	resolveSkill,
	type ActiveSkillDefinition,
	type Rng,
} from "@app/shared";

function makeRngFromSequence(values: number[]): Rng {
	let idx = 0;
	return (() => {
		const v = values[idx] ?? 0;
		idx += 1;
		return v;
	}) as Rng;
}

const ATTRS = {
	strength: 10,
	dexterity: 10,
	constitution: 10,
	intelligence: 10,
	wisdom: 10,
	charisma: 10,
};

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
		skills: {},
		activeEffects: [],
		numericBuffs: {},
		passiveDamageBonuses: [],
		statusImmunities: [],
		def: { type: "hero", classId: "warrior" },
		level: 1,
		xp: 0,
		hitDie: 10,
		xpReward: 0,
		savingThrowProficiencies: ["strength", "constitution"],
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
		skills: {},
		activeEffects: [],
		numericBuffs: {},
		passiveDamageBonuses: [],
		statusImmunities: [],
		def: { type: "npc", npcId: "goblin" },
		level: 0,
		xp: 0,
		hitDie: 0,
		xpReward: 30,
		savingThrowProficiencies: ["dexterity"],
		challengeRating: 1,
		...overrides,
	};
}

describe("Ability proficiency bonus tables", () => {
	it("proficiencyBonusFromLevel matches 5e table", () => {
		expect(proficiencyBonusFromLevel(1)).toBe(2);
		expect(proficiencyBonusFromLevel(4)).toBe(2);
		expect(proficiencyBonusFromLevel(5)).toBe(3);
		expect(proficiencyBonusFromLevel(8)).toBe(3);
		expect(proficiencyBonusFromLevel(9)).toBe(4);
		expect(proficiencyBonusFromLevel(12)).toBe(4);
		expect(proficiencyBonusFromLevel(13)).toBe(5);
		expect(proficiencyBonusFromLevel(16)).toBe(5);
		expect(proficiencyBonusFromLevel(17)).toBe(6);
		expect(proficiencyBonusFromLevel(20)).toBe(6);
	});

	it("proficiencyBonusFromChallengeRating matches CR ranges", () => {
		expect(proficiencyBonusFromChallengeRating(0)).toBe(2);
		expect(proficiencyBonusFromChallengeRating(4)).toBe(2);
		expect(proficiencyBonusFromChallengeRating(5)).toBe(3);
		expect(proficiencyBonusFromChallengeRating(8)).toBe(3);
		expect(proficiencyBonusFromChallengeRating(9)).toBe(4);
		expect(proficiencyBonusFromChallengeRating(12)).toBe(4);
		expect(proficiencyBonusFromChallengeRating(13)).toBe(5);
		expect(proficiencyBonusFromChallengeRating(16)).toBe(5);
		expect(proficiencyBonusFromChallengeRating(17)).toBe(6);
		expect(proficiencyBonusFromChallengeRating(20)).toBe(6);
		expect(proficiencyBonusFromChallengeRating(21)).toBe(7);
		expect(proficiencyBonusFromChallengeRating(24)).toBe(7);
		expect(proficiencyBonusFromChallengeRating(25)).toBe(8);
		expect(proficiencyBonusFromChallengeRating(28)).toBe(8);
		expect(proficiencyBonusFromChallengeRating(29)).toBe(9);
	});
});

describe("resolveSavingThrow", () => {
	it("natural 20 is auto_success regardless of DC", () => {
		const defender = makeNpcActor({
			attributes: { ...ATTRS, dexterity: 8 },
		});

		const res = resolveSavingThrow({
			rng: makeRngFromSequence([0.999]),
			defender,
			saveAbility: "dexterity",
			dc: 999,
		});

		expect(res.auto).toBe("auto_success");
		expect(res.success).toBe(true);
	});

	it("natural 1 is auto_fail regardless of DC", () => {
		const defender = makeNpcActor({
			attributes: { ...ATTRS, dexterity: 20 },
		});

		const res = resolveSavingThrow({
			rng: makeRngFromSequence([0]),
			defender,
			saveAbility: "dexterity",
			dc: 0,
		});

		expect(res.auto).toBe("auto_fail");
		expect(res.success).toBe(false);
	});

	it("proficiency is applied when the defender is proficient", () => {
		const proficientDefender = makeHeroActor({
			level: 1,
			attributes: { ...ATTRS, dexterity: 10 },
			savingThrowProficiencies: ["dexterity"],
		});
		const nonProficientDefender = makeHeroActor({
			level: 1,
			attributes: { ...ATTRS, dexterity: 10 },
			savingThrowProficiencies: [],
		});

		// rng value chosen so rollD20 -> naturalRoll 10
		const rng = makeRngFromSequence([0.49]);
		const dc = 11; // 10 + 0 (ability mod) would fail without proficiency, succeed with +2

		const pRes = resolveSavingThrow({
			rng,
			defender: proficientDefender,
			saveAbility: "dexterity",
			dc,
		});
		expect(pRes.success).toBe(true);

		const rng2 = makeRngFromSequence([0.49]);
		const npRes = resolveSavingThrow({
			rng: rng2,
			defender: nonProficientDefender,
			saveAbility: "dexterity",
			dc,
		});
		expect(npRes.success).toBe(false);
		expect(npRes.proficiencyBonusApplied).toBe(0);
	});
});

describe("area_damage saving throw scaling", () => {
	const skillId = "test_area";

	const skillDef: ActiveSkillDefinition = {
		skillType: "active",
		id: skillId,
		name: "Test Area",
		description: "Test",
		cooldown: 0,
		targetType: "none",
		effects: [
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
	};

	it("halves damage on successful save (and emits saving_throw event)", () => {
		const caster = makeHeroActor({
			id: "caster",
			idx: 0,
			level: 1,
			attributes: { ...ATTRS, intelligence: 10 },
		});
		const defender = makeNpcActor({
			id: "defender",
			idx: 1,
			hp: 3,
			attributes: { ...ATTRS, dexterity: 10 },
			savingThrowProficiencies: ["dexterity"],
		});

		const floorState = {
			...createEmptyFloorState(),
			actorsById: {
				[caster.id]: caster,
				[defender.id]: defender,
			},
		};

		// 2d6 -> both rolls = 1 (rng=0), then d20 -> natural 20 (rng=0.999)
		const rng = makeRngFromSequence([0, 0, 0.999]);

		const dc = computeSavingThrowDC(caster, "intelligence");
		expect(dc).toBe(10); // 8 + PB(2) + INT mod(0)

		const res = resolveSkill({
			skillDef,
			caster,
			casterId: caster.id,
			floorState,
			width: 3,
			height: 3,
			rng,
		});
		if ("error" in res) throw new Error(res.error);

		expect(res.floorState.actorsById[defender.id]!.hp).toBe(2);

		const saveEvt = res.events.find((e) => e.type === "saving_throw");
		expect(saveEvt).toBeDefined();
		if (saveEvt && saveEvt.type === "saving_throw") {
			expect(saveEvt.defenderId).toBe(defender.id);
			expect(saveEvt.success).toBe(true);
			expect(saveEvt.auto).toBe("auto_success");
		}
	});

	it("does full damage on failed save (and keeps resistance logic intact)", () => {
		const caster = makeHeroActor({
			id: "caster",
			idx: 0,
			level: 1,
			attributes: { ...ATTRS, intelligence: 10 },
		});
		const defender = makeNpcActor({
			id: "defender",
			idx: 1,
			hp: 3,
			damageResistances: ["fire"],
			attributes: { ...ATTRS, dexterity: 10 },
			savingThrowProficiencies: ["dexterity"],
		});

		const floorState = {
			...createEmptyFloorState(),
			actorsById: {
				[caster.id]: caster,
				[defender.id]: defender,
			},
		};

		// 2d6 -> damage = 2, then d20 -> natural 1 (auto_fail)
		const rng = makeRngFromSequence([0, 0, 0]);

		const res = resolveSkill({
			skillDef,
			caster,
			casterId: caster.id,
			floorState,
			width: 3,
			height: 3,
			rng,
		});
		if ("error" in res) throw new Error(res.error);

		// raw damage 2, resistance halves -> floor(2/2)=1 => hp 3-1=2
		expect(res.floorState.actorsById[defender.id]!.hp).toBe(2);
	});
});
