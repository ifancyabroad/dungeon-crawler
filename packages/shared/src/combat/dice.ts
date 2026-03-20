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

/** Ability modifier: floor((score - 10) / 2). */
export function abilityModifier(score: number): number {
	return Math.floor((score - 10) / 2);
}

/** Compute unarmored AC: 10 + DEX modifier. */
export function computeUnarmoredAC(dexterity: number): number {
	return 10 + abilityModifier(dexterity);
}

/**
 * Parse a dice expression string like "2d6" into count and sides.
 * Throws if the expression is not in NdM format.
 */
export function parseDice(expr: string): { count: number; sides: number } {
	const match = /^(\d+)d(\d+)$/i.exec(expr.trim());
	if (!match) throw new Error(`Invalid dice expression: "${expr}"`);
	return { count: parseInt(match[1], 10), sides: parseInt(match[2], 10) };
}

/**
 * Roll a dice expression string (e.g. "2d6"). Returns the raw total before any modifier.
 * `critMultiplier` doubles the number of dice rolled (critical-hit style rule).
 */
export function rollDiceExpr(rng: Rng, expr: string, critMultiplier = 1): number {
	const { count, sides } = parseDice(expr);
	const rolls = count * critMultiplier;
	let total = 0;
	for (let i = 0; i < rolls; i++) total += rollDice(rng, sides);
	return total;
}
