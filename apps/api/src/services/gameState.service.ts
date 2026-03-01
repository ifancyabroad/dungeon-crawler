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

/**
 * Load latest snapshot, replay actions with turn >= snapshotTurn, build full GameState.
 * Action log entry turn = turn BEFORE apply; after apply state.turn = entry.turn + 1.
 */
export async function reconstructState(gameId: string): Promise<GameState | null> {
	const session = await GameSession.findOne({ gameId }).lean().exec();
	if (!session) return null;

	const snapshot = await GameSnapshot.findOne({
		gameId,
		turn: session.latestSnapshotTurn,
	})
		.lean()
		.exec();
	if (!snapshot) return null;

	const rawSnapshot = snapshot as { state: unknown };
	const parsed = PersistedDynamicStateSchema.safeParse(rawSnapshot.state);
	if (!parsed.success) return null;
	const snapshotState = parsed.data;

	const logEntries = await GameActionLog.find({
		gameId,
		turn: { $gte: session.latestSnapshotTurn },
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
