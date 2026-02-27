/**
 * Deterministic, seedable PRNG for use in shared only.
 * No Math.random or other non-deterministic APIs.
 */

/** Returns a function that yields the next float in [0, 1) for the given seed. */
export function createRng(seed: number): () => number {
	let state = seed >>> 0;
	return function next(): number {
		// mulberry32
		state = (state + 0x6d2b79f5) >>> 0; // 32-bit overflow
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export type Rng = ReturnType<typeof createRng>;
