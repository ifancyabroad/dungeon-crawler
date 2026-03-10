/**
 * Reconstruct game state from snapshot + action log (turn >= snapshotTurn).
 * In-memory session store for active games; walkability cached to avoid regenerating base maps on every action.
 */

import { ZodError } from "zod";
import {
	ActionSchema,
	applyAction,
	buildGameStateFromPersisted,
	computeOpacityMask,
	computeWalkableMaskForFloor,
	createActionContext,
	PersistedDynamicStateSchema,
	regenerateBaseMaps,
	type Action,
	type ApplyActionContext,
	type ApplyActionResult,
	type GameState,
	type PersistedDynamicState,
} from "@app/shared";
import { GameActionLog } from "../models/gameActionLog.model";
import { GameSession } from "../models/gameSession.model";
import { GameSnapshot } from "../models/gameSnapshot.model";
import { runTransaction } from "../config/db";

interface SessionEntry {
	state: GameState;
	walkableByFloor: Uint8Array[];
	opacityByFloor: Uint8Array[];
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

function computeFloorMasks(state: GameState): { walkable: Uint8Array[]; opacity: Uint8Array[] } {
	const baseLayers = regenerateBaseMaps(
		state.seed,
		state.floors.map((f) => f.config),
		state.mapGenVersion,
	);
	const walkable = baseLayers.map((base, i) =>
		computeWalkableMaskForFloor(base, state.floors[i]?.state.tileOverrides ?? {}),
	);
	const opacity = baseLayers.map((base) =>
		computeOpacityMask(base.wall, base.width, base.height),
	);
	return { walkable, opacity };
}

export function getSessionState(gameId: string): GameState | undefined {
	return sessionStore.get(gameId)?.state;
}

/** Returns walkability mask per floor (Uint8Array, 1=walkable). Undefined if session not loaded. */
export function getSessionWalkable(gameId: string): Uint8Array[] | undefined {
	return sessionStore.get(gameId)?.walkableByFloor;
}

/** Returns opacity mask per floor (Uint8Array, 1=opaque). Undefined if session not loaded. */
export function getSessionOpacity(gameId: string): Uint8Array[] | undefined {
	return sessionStore.get(gameId)?.opacityByFloor;
}

/** Set session state and recompute walkability + opacity masks for all floors. */
export function setSessionState(gameId: string, state: GameState): void {
	const { walkable, opacity } = computeFloorMasks(state);
	sessionStore.set(gameId, { state, walkableByFloor: walkable, opacityByFloor: opacity });
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

function makeSessionContext(gameId: string, errorContext?: string): ApplyActionContext {
	const walkable = getSessionWalkable(gameId);
	const opacity = getSessionOpacity(gameId);
	if (!walkable || !opacity) {
		throw new Error(
			errorContext
				? `${errorContext}: missing cached masks for game ${gameId}`
				: `missing cached masks for game ${gameId}`,
		);
	}
	return createActionContext(walkable, opacity);
}

/**
 * Apply an action with context built from session cache. Use from socket action handler.
 * Throws if cached masks are missing for the game.
 */
export function applyAuthoritativeAction(
	gameId: string,
	state: GameState,
	action: Action,
): ApplyActionResult {
	const context = makeSessionContext(gameId, "applyAuthoritativeAction");
	return applyAction(state, action, context);
}

export function deleteSessionState(gameId: string): void {
	sessionStore.delete(gameId);
}

/**
 * Persist an action (and periodic snapshot) in a single transaction.
 * Returns false without throwing on duplicate-key error (action already persisted at this turn).
 */
export async function persistAction(
	gameId: string,
	turn: number,
	action: Action,
	persistedState: PersistedDynamicState,
	snapshotInterval: number,
): Promise<boolean> {
	try {
		const now = new Date();
		const isSnapshotTurn = turn % snapshotInterval === 0;

		await runTransaction(async (session) => {
			await GameActionLog.create([{ gameId, turn, action }], { session });

			if (isSnapshotTurn) {
				await GameSnapshot.create(
					[{ gameId, turn, state: persistedState, createdAt: now }],
					{ session },
				);
			}

			const $set: Record<string, unknown> = { lastSeenAt: now };
			if (isSnapshotTurn) $set.latestSnapshotTurn = turn;
			await GameSession.updateOne({ gameId }, { $set }, { session });
		});

		return true;
	} catch (err: unknown) {
		const isDuplicate =
			err &&
			typeof err === "object" &&
			"code" in err &&
			(err as { code: number }).code === 11000;
		if (isDuplicate) return false;
		throw err;
	}
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

	const { walkable, opacity } = computeFloorMasks(fullState);
	const applyContext = createActionContext(walkable, opacity);

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
