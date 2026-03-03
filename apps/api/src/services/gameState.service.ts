/**
 * Reconstruct game state from snapshot + action log (turn >= snapshotTurn).
 * In-memory session store for active games; walkability cached to avoid regenerating base maps on every action.
 */

import { ZodError } from "zod";
import {
	ActionSchema,
	applyAction,
	buildGameStateFromPersisted,
	computeWalkableMaskForFloor,
	PersistedDynamicStateSchema,
	regenerateBaseMaps,
	type Action,
	type ApplyActionContext,
	type ApplyActionResult,
	type GameState,
} from "@app/shared";
import { GameActionLog } from "../models/gameActionLog.model";
import { GameSession } from "../models/gameSession.model";
import { GameSnapshot } from "../models/gameSnapshot.model";

interface SessionEntry {
	state: GameState;
	walkableByFloor: Uint8Array[];
}

/** Thrown when snapshot or action log fails Zod parse (distinct from session/snapshot not found). */
export class StateCorruptError extends Error {
	readonly code = "STATE_CORRUPT";
	constructor(
		message: string,
		public readonly cause?: unknown,
	) {
		super(message);
		this.name = "StateCorruptError";
	}
}

const sessionStore = new Map<string, SessionEntry>();

function computeWalkableByFloor(state: GameState): Uint8Array[] {
	const baseLayers = regenerateBaseMaps(
		state.seed,
		state.floors.map((f) => f.config),
		state.mapGenVersion,
	);
	return baseLayers.map((base, i) =>
		computeWalkableMaskForFloor(base, state.floors[i]?.state.tileOverrides ?? {}),
	);
}

export function getSessionState(gameId: string): GameState | undefined {
	return sessionStore.get(gameId)?.state;
}

/** Returns walkability mask per floor (Uint8Array, 1=walkable). Undefined if session not loaded. */
export function getSessionWalkable(gameId: string): Uint8Array[] | undefined {
	return sessionStore.get(gameId)?.walkableByFloor;
}

/** Set session state and recompute walkability masks for all floors. No optional masks; callers never pass walkableByFloor. */
export function setSessionState(gameId: string, state: GameState): void {
	const walkableByFloor = computeWalkableByFloor(state);
	sessionStore.set(gameId, { state, walkableByFloor });
}

const inFlightLoads = new Map<string, Promise<GameState | null>>();

/** Get or reconstruct and cache state for a game. Returns null if session or snapshot missing. Deduplicates concurrent loads for the same gameId. */
export async function ensureSessionLoaded(gameId: string): Promise<GameState | null> {
	const cached = getSessionState(gameId);
	if (cached) return cached;

	let promise = inFlightLoads.get(gameId);
	if (!promise) {
		promise = (async (): Promise<GameState | null> => {
			try {
				const state = await reconstructState(gameId);
				if (state) setSessionState(gameId, state);
				return state;
			} catch (err) {
				if (err instanceof StateCorruptError) throw err;
				console.error(
					"[ensureSessionLoaded] reconstructState failed for gameId:",
					gameId,
					err,
				);
				return null;
			} finally {
				inFlightLoads.delete(gameId);
			}
		})();
		inFlightLoads.set(gameId, promise);
	}
	return promise;
}

function makeWalkableContext(masks: Uint8Array[], errorContext?: string): ApplyActionContext {
	return {
		getWalkableMask(fi: number): Uint8Array {
			const mask = masks[fi];
			if (mask === undefined) {
				throw new Error(
					errorContext
						? `${errorContext}: missing walkability mask for floor ${fi}`
						: `missing walkability mask for floor ${fi}`,
				);
			}
			return mask;
		},
	};
}

/**
 * Apply an action with context built from session cache. Use from socket action handler.
 * Throws if walkability cache is missing for the game or for the hero's floor.
 */
export function applyAuthoritativeAction(
	gameId: string,
	state: GameState,
	action: Action,
): ApplyActionResult {
	const masks = getSessionWalkable(gameId);
	if (!masks) {
		throw new Error(`applyAuthoritativeAction: no walkability cache for game ${gameId}`);
	}
	const context = makeWalkableContext(masks, `applyAuthoritativeAction (game ${gameId})`);
	return applyAction(state, action, context);
}

export function deleteSessionState(gameId: string): void {
	sessionStore.delete(gameId);
}

/**
 * Load latest snapshot, then replay action log entries where entry.turn > snapshotTurn (each entry's
 * turn is the state.turn after that action was applied). Build full GameState.
 * Invalid snapshot or action log entry throws (caller should catch and surface state_corrupt).
 */
export async function reconstructState(gameId: string): Promise<GameState | null> {
	const session = await GameSession.findOne({ gameId }).lean().exec();
	if (!session) {
		console.warn("[reconstructState] no session for gameId:", gameId);
		return null;
	}

	const snapshotTurn = session.latestSnapshotTurn ?? 0;
	const snapshot = await GameSnapshot.findOne({
		gameId,
		turn: snapshotTurn,
	})
		.lean()
		.exec();
	if (!snapshot) {
		console.warn("[reconstructState] no snapshot for gameId:", gameId, "turn:", snapshotTurn);
		return null;
	}

	const raw = (snapshot as { state: unknown }).state;
	if (raw === null || raw === undefined) {
		throw new Error(`[reconstructState] snapshot state missing for gameId: ${gameId}`);
	}
	let snapshotState;
	try {
		snapshotState = PersistedDynamicStateSchema.parse(raw);
	} catch (err) {
		const msg = `[reconstructState] snapshot parse failed for gameId: ${gameId}`;
		console.error(msg, err instanceof ZodError ? err.flatten() : err);
		throw new StateCorruptError(msg, err);
	}

	const logEntries = await GameActionLog.find({
		gameId,
		turn: { $gt: snapshotTurn },
	})
		.sort({ turn: 1 })
		.lean()
		.exec();

	let fullState = buildGameStateFromPersisted(
		session.seed,
		session.mapGenVersion,
		session.floorConfigs,
		snapshotState,
	);

	const walkableByFloor = computeWalkableByFloor(fullState);
	const applyContext = makeWalkableContext(walkableByFloor, "reconstructState");

	for (const entry of logEntries) {
		let action;
		try {
			action = ActionSchema.parse((entry as { action: unknown }).action);
		} catch (err) {
			const msg = `[reconstructState] action log parse failed for gameId: ${gameId}, turn: ${(entry as { turn?: number }).turn}`;
			console.error(msg, err instanceof ZodError ? err.flatten() : err);
			throw new StateCorruptError(msg, err);
		}
		const result = applyAction(fullState, action, applyContext);
		if (!result.ok) continue;
		fullState = result.state;
	}

	return fullState;
}
