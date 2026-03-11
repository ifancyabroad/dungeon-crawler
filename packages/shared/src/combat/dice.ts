/**
 * Deterministic dice helpers. All functions consume from a seeded Rng
 * so results are reproducible given the same RNG state.
 */

import type { Rng } from "../rng";

/** Roll a single die with the given number of sides. Returns 1..sides. */
export function rollDice(rng: Rng, sides: number): number {
	return Math.floor(rng() * sides) + 1;
}

/** Roll a D20. Shorthand for rollDice(rng, 20). */
export function rollD20(rng: Rng): number {
	return rollDice(rng, 20);
}

/** D&D 5e ability modifier: floor((score - 10) / 2). */
export function abilityModifier(score: number): number {
	return Math.floor((score - 10) / 2);
}

/** Compute unarmored AC: 10 + DEX modifier. */
export function computeUnarmoredAC(dexterity: number): number {
	return 10 + abilityModifier(dexterity);
}
