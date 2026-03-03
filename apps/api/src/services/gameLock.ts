/**
 * Per-game mutex: only one action pipeline runs at a time per gameId.
 * Lock is released on throw via try/finally.
 * Uses globalThis so all module instances (e.g. test + server) share the same lock.
 */

const GLOBAL_KEY = "__dungeon_gameLock_byGame__";

function getByGame(): Map<string, Promise<void>> {
	if (typeof globalThis === "undefined") return new Map<string, Promise<void>>();
	const g = globalThis as Record<string, unknown>;
	let m = g[GLOBAL_KEY];
	if (!m || !(m instanceof Map)) {
		m = new Map<string, Promise<void>>();
		g[GLOBAL_KEY] = m;
	}
	return m as Map<string, Promise<void>>;
}

/**
 * Run fn with exclusive lock for gameId. Waits for any in-flight run for the same gameId,
 * then runs fn. Lock is always released in finally (including on throw).
 */
export async function withGameLock<T>(gameId: string, fn: () => Promise<T>): Promise<T> {
	const byGame = getByGame();
	const tail = byGame.get(gameId) ?? Promise.resolve();
	let resolveNext!: () => void;
	const next = new Promise<void>((r) => {
		resolveNext = r;
	});
	byGame.set(gameId, next);

	await tail;
	try {
		return await fn();
	} finally {
		resolveNext();
	}
}

/** Test-only: clear the lock map so tests start from a clean state. Ensures one shared lock across test and server. */
export function __resetGameLocksForTest(): void {
	getByGame().clear();
}
