import { describe, expect, it } from "vitest";
import {
	applyPassiveSkill,
	createInitialState,
	DEFAULT_FLOOR_CONFIG,
	DEFAULT_HERO_INIT,
	getHero,
} from "../index";
import {
	mockPassiveAcSkill,
	mockPassiveDamageDice,
	mockPassiveResistance,
	mockPassiveStrSkill,
	SEED,
} from "./skillSystem.fixtures";

describe("applyPassiveSkill", () => {
	it("modify_attribute increases the given attribute", () => {
		const hero = getHero(createInitialState(SEED, [DEFAULT_FLOOR_CONFIG], DEFAULT_HERO_INIT))!;
		const updated = applyPassiveSkill(hero, mockPassiveStrSkill, 0, 1);
		expect(updated.attributes.strength).toBe(hero.attributes.strength + 2);
	});

	it("modify_armor_class increases armorClass", () => {
		const hero = getHero(createInitialState(SEED, [DEFAULT_FLOOR_CONFIG], DEFAULT_HERO_INIT))!;
		const updated = applyPassiveSkill(hero, mockPassiveAcSkill, 0, 1);
		expect(updated.armorClass).toBe(hero.armorClass + 1);
	});

	it("add_damage_resistance is idempotent", () => {
		const hero = getHero(createInitialState(SEED, [DEFAULT_FLOOR_CONFIG], DEFAULT_HERO_INIT))!;
		const once = applyPassiveSkill(hero, mockPassiveResistance, 0, 1);
		const twice = applyPassiveSkill(once, mockPassiveResistance, 1, 1);
		expect(twice.damageResistances.filter((d) => d === "fire")).toHaveLength(1);
	});

	it("add_damage_dice appends to passiveDamageBonuses", () => {
		const hero = getHero(createInitialState(SEED, [DEFAULT_FLOOR_CONFIG], DEFAULT_HERO_INIT))!;
		const updated = applyPassiveSkill(hero, mockPassiveDamageDice, 0, 1);
		expect(updated.passiveDamageBonuses[0]?.dice).toBe("1d6");
	});
});
