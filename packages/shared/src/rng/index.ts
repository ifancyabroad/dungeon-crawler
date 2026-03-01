/**
 * Deterministic, seedable PRNG for use in shared only.
 * No Math.random or other non-deterministic APIs.
 * Supports serializable RngState (xorshift32) for replay and snapshots.
 */

import type { RngState } from "../game/types";

/** Returns a function that yields the next float in [0, 1) for the given seed. */
export function createRng(seed: number): () => number {
	let state = seed >>> 0;
	return function next(): number {
		// mulberry32 (used for map gen; not persisted)
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export type Rng = ReturnType<typeof createRng>;

/** Create initial serializable RNG state from seed (xorshift32). Used for new games and replay. */
export function createInitialRngState(seed: number): RngState {
	const s = seed >>> 0 || 1;
	return { algo: "xorshift32", s };
}

/** One step of xorshift32; returns [value in [0,1), new state]. */
function xorshift32Next(s: number): [number, number] {
	let state = s >>> 0;
	state ^= state << 13;
	state ^= state >>> 17;
	state ^= state << 5;
	state = state >>> 0;
	return [state / 4294967296, state];
}

/**
 * Build an Rng from serializable state. Each call advances state; getState() returns current state.
 * Use for applyAction and replay so rngState can be persisted in snapshots.
 */
export function createRngFromState(initial: RngState): { rng: Rng; getState: () => RngState } {
	if (initial.algo !== "xorshift32") {
		throw new Error(`Unsupported RngState algo: ${(initial as { algo: string }).algo}`);
	}
	let s = initial.s >>> 0;
	return {
		rng: function next(): number {
			const [value, newS] = xorshift32Next(s);
			s = newS;
			return value;
		},
		getState: (): RngState => ({ algo: "xorshift32", s }),
	};
}
