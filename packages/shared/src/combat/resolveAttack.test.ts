import { describe, expect, it } from "vitest";
import {
	createInitialState,
	DEFAULT_FLOOR_CONFIG,
	DEFAULT_HERO_INIT,
	getHero,
	resolveAttack,
} from "../index";

function makeAttackerAndDefender() {
	const state = createInitialState(42, [DEFAULT_FLOOR_CONFIG], DEFAULT_HERO_INIT);
	const hero = getHero(state)!;
	const defender = {
		...hero,
		id: "defender",
		faction: "hostile" as const,
		activeEffects: [],
	};
	return { hero, defender };
}

describe("resolveAttack", () => {
	it("critical threshold forces critical and hit", () => {
		const { hero, defender } = makeAttackerAndDefender();
		const attacker = { ...hero, critThreshold: 1 };
		const alwaysLowRng = () => 0;
		const result = resolveAttack(attacker, defender, alwaysLowRng);
		expect(result.critical).toBe(true);
		expect(result.hit).toBe(true);
		expect(result.damage).toBeGreaterThanOrEqual(0);
	});

	it("defender AC bonuses affect computed targetAc", () => {
		const { hero, defender } = makeAttackerAndDefender();
		const boostedDefender = {
			...defender,
			activeEffects: [
				...defender.activeEffects,
				{
					id: "ac_boost",
					sourceActorId: hero.id,
					remainingTurns: 2,
					adjustments: { acBonus: 3 },
				},
			],
		};
		const result = resolveAttack(hero, boostedDefender, () => 0.5);
		expect(result.targetAc).toBe(defender.armorClass + 3);
	});
});
