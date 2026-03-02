/**
 * Reconstruct game state from snapshot + action log (turn >= snapshotTurn).
 * In-memory session store for active games; walkability cached to avoid regenerating base maps on every action.
 */

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

export function setSessionState(
	gameId: string,
	state: GameState,
	walkableByFloor?: Uint8Array[],
): void {
	const existing = sessionStore.get(gameId);
	const walkable = walkableByFloor ?? existing?.walkableByFloor ?? computeWalkableByFloor(state);
	sessionStore.set(gameId, { state, walkableByFloor: walkable });
}

/** Get or reconstruct and cache state for a game. Returns null if session or snapshot missing. */
export async function ensureSessionLoaded(gameId: string): Promise<GameState | null> {
	const cached = getSessionState(gameId);
	if (cached) return cached;
	const state = await reconstructState(gameId);
	if (state) setSessionState(gameId, state);
	return state;
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

const asObj = (x: unknown): Record<string, unknown> =>
	x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {};

/** One floor state: strip non-number tileOverrides, drop invalid actors. Schema applies defaults (e.g. actor.skills). */
function normalizeOneFloor(rawFloor: unknown) {
	const o = asObj(rawFloor);
	const rawOverrides = asObj(o.tileOverrides);
	const tileOverrides: Record<string, number> = {};
	for (const [k, v] of Object.entries(rawOverrides)) {
		if (typeof v === "number") tileOverrides[k] = v;
	}
	const rawActors = asObj(o.actorsById);
	const actorsById: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(rawActors)) {
		if (v != null && typeof v === "object" && !Array.isArray(v)) actorsById[k] = v;
	}
	return { tileOverrides, actorsById };
}

/** Mongoose Mixed can return floors as array-like or sparse; normalize to a real array of floor objects. */
function normalizeSnapshotFloors(raw: Record<string, unknown>) {
	const rawFloors = raw.floors;
	const arr: unknown[] = Array.isArray(rawFloors)
		? [...rawFloors]
		: rawFloors && typeof rawFloors === "object"
			? Array.from(
					{ length: Object.keys(rawFloors).length },
					(_, i) => (rawFloors as Record<string, unknown>)[String(i)],
				)
			: [];
	const floors: { tileOverrides: Record<string, number>; actorsById: Record<string, unknown> }[] =
		[];
	for (let i = 0; i < arr.length; i++) {
		floors.push(normalizeOneFloor(arr[i]));
	}
	return {
		turn: raw.turn,
		heroId: raw.heroId,
		heroFloorIndex: raw.heroFloorIndex,
		floors,
		rngState: raw.rngState,
	};
}

/**
 * Load latest snapshot, replay actions with turn >= snapshotTurn, build full GameState.
 * Action log entry turn = turn BEFORE apply; after apply state.turn = entry.turn + 1.
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

	const raw = (snapshot as { state: unknown }).state as
		| Record<string, unknown>
		| null
		| undefined;
	if (!raw || typeof raw !== "object") {
		console.warn(
			"[reconstructState] snapshot state missing or not an object for gameId:",
			gameId,
		);
		return null;
	}

	const parsed = PersistedDynamicStateSchema.safeParse(normalizeSnapshotFloors(raw));
	if (!parsed.success) {
		console.warn(
			"[reconstructState] snapshot schema invalid for gameId:",
			gameId,
			parsed.error.flatten(),
		);
		return null;
	}
	const snapshotState = parsed.data;

	const logEntries = await GameActionLog.find({
		gameId,
		turn: { $gte: snapshotTurn },
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
		const actionParse = ActionSchema.safeParse((entry as { action: unknown }).action);
		if (!actionParse.success) continue;
		const result = applyAction(fullState, actionParse.data, applyContext);
		if (!result.ok) continue;
		fullState = result.state;
	}

	return fullState;
}
