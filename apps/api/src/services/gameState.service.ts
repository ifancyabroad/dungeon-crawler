/**
 * Reconstruct game state from snapshot + action log (turn >= snapshotTurn).
 * In-memory session store for active games; no full DB reconstruction on every action.
 */

import {
	ActionSchema,
	applyAction,
	buildGameStateFromPersisted,
	PersistedDynamicStateSchema,
	type GameState,
} from "@app/shared";
import { GameActionLog } from "../models/gameActionLog.model";
import { GameSession } from "../models/gameSession.model";
import { GameSnapshot } from "../models/gameSnapshot.model";

const sessionStore = new Map<string, GameState>();

export function getSessionState(gameId: string): GameState | undefined {
	return sessionStore.get(gameId);
}

export function setSessionState(gameId: string, state: GameState): void {
	sessionStore.set(gameId, state);
}

export function deleteSessionState(gameId: string): void {
	sessionStore.delete(gameId);
}

/** Mongoose Mixed can return floors as array-like or sparse; normalize to a real array of floor objects. */
function normalizeSnapshotFloors(raw: Record<string, unknown>): Record<string, unknown> {
	const rawFloors = raw.floors;
	const arr: unknown[] = Array.isArray(rawFloors)
		? [...rawFloors]
		: rawFloors && typeof rawFloors === "object"
			? Array.from(
					{ length: Object.keys(rawFloors).length },
					(_, i) => (rawFloors as Record<string, unknown>)[String(i)],
				)
			: [];
	const asObj = (x: unknown): Record<string, unknown> =>
		x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {};
	const floors = arr.map((f: unknown) => {
		const o = asObj(f);
		return {
			tileOverrides: asObj(o.tileOverrides) as Record<string, number>,
			entities: asObj(o.entities),
			items: asObj(o.items),
		};
	});
	return { ...raw, floors };
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

	const rawSnapshot = snapshot as { state: unknown };
	const raw = rawSnapshot.state as Record<string, unknown> | null | undefined;
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

	for (const entry of logEntries) {
		const logEntry = entry as { action: unknown };
		const actionParse = ActionSchema.safeParse(logEntry.action);
		if (!actionParse.success) continue;
		const result = applyAction(fullState, actionParse.data);
		if (!result.ok) continue;
		fullState = result.state;
	}

	return fullState;
}
