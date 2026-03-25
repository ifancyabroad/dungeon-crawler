/**
 * Debug controller — state mutation endpoints for development use only.
 * All handlers require requireDebugSecret + requireGame middlewares.
 * Mutations are baked in as forced snapshots; no action log entry is written.
 */

import type { RequestHandler } from "express";
import { z } from "zod";
import { gameStateToPersisted, getHero, PersistedDynamicStateSchema } from "@app/shared";
import { skillsById } from "@app/content";
import {
	getSessionState,
	setSessionState,
	setDebugFlags,
	getDebugFlags,
	persistDebugSnapshot,
} from "../services/gameState.service";

function getGameId(locals: Record<string, unknown>): string {
	const session = locals["gameSession"] as { gameId: string };
	return session.gameId;
}

/** POST /api/debug/god-mode — toggle god mode for this session. */
export const setGodMode: RequestHandler = (req, res): void => {
	const schema = z.object({ enabled: z.boolean() });
	const parsed = schema.safeParse(req.body);
	if (!parsed.success) {
		res.status(400).json({ error: "Body must be { enabled: boolean }" });
		return;
	}

	const gameId = getGameId(res.locals);
	const state = getSessionState(gameId);
	if (!state) {
		res.status(404).json({ error: "Session not loaded" });
		return;
	}

	setDebugFlags(gameId, { godMode: parsed.data.enabled });
	res.json({ ok: true, godMode: parsed.data.enabled });
};

/** POST /api/debug/god-mode/status — return current god mode flag. */
export const getGodModeStatus: RequestHandler = (req, res): void => {
	const gameId = getGameId(res.locals);
	const state = getSessionState(gameId);
	if (!state) {
		res.status(404).json({ error: "Session not loaded" });
		return;
	}
	const flags = getDebugFlags(gameId);
	res.json({ ok: true, godMode: flags.godMode });
};

/** POST /api/debug/heal — restore hero HP to max. */
export const healHero: RequestHandler = async (req, res) => {
	const gameId = getGameId(res.locals);
	const state = getSessionState(gameId);
	if (!state) {
		res.status(404).json({ error: "Session not loaded" });
		return;
	}

	const hero = getHero(state);
	if (!hero) {
		res.status(400).json({ error: "Hero not found in state" });
		return;
	}

	const floorState = state.floors[state.heroFloorIndex].state;
	const updatedHero = { ...hero, hp: hero.maxHp, alive: true };
	const updatedActors = { ...floorState.actorsById, [hero.id]: updatedHero };
	const updatedFloorState = { ...floorState, actorsById: updatedActors };
	const updatedFloors = state.floors.map((f, i) =>
		i === state.heroFloorIndex ? { ...f, state: updatedFloorState } : f,
	);
	const newState = { ...state, floors: updatedFloors };

	const persisted = gameStateToPersisted(newState);
	PersistedDynamicStateSchema.parse(persisted);
	await persistDebugSnapshot(gameId, newState.turn, persisted);
	setSessionState(gameId, newState);

	res.json({ ok: true, state: newState });
};

/** POST /api/debug/give-skill — grant a skill to the hero (cooldown 0). */
export const giveSkill: RequestHandler = async (req, res) => {
	const schema = z.object({ skillId: z.string().min(1) });
	const parsed = schema.safeParse(req.body);
	if (!parsed.success) {
		res.status(400).json({ error: "Body must be { skillId: string }" });
		return;
	}

	const { skillId } = parsed.data;
	if (!skillsById[skillId]) {
		res.status(400).json({ error: `Unknown skill: ${skillId}` });
		return;
	}

	const gameId = getGameId(res.locals);
	const state = getSessionState(gameId);
	if (!state) {
		res.status(404).json({ error: "Session not loaded" });
		return;
	}

	const hero = getHero(state);
	if (!hero) {
		res.status(400).json({ error: "Hero not found in state" });
		return;
	}

	const updatedHero = {
		...hero,
		skills: { ...hero.skills, [skillId]: { rank: 1, cooldownRemaining: 0 } },
	};
	const floorState = state.floors[state.heroFloorIndex].state;
	const updatedActors = { ...floorState.actorsById, [hero.id]: updatedHero };
	const updatedFloorState = { ...floorState, actorsById: updatedActors };
	const updatedFloors = state.floors.map((f, i) =>
		i === state.heroFloorIndex ? { ...f, state: updatedFloorState } : f,
	);
	const newState = { ...state, floors: updatedFloors };

	const persisted = gameStateToPersisted(newState);
	PersistedDynamicStateSchema.parse(persisted);
	await persistDebugSnapshot(gameId, newState.turn, persisted);
	setSessionState(gameId, newState);

	res.json({ ok: true, state: newState });
};

/** POST /api/debug/kill-enemies — kill every non-hero actor on the hero's current floor. */
export const killEnemies: RequestHandler = async (req, res) => {
	const gameId = getGameId(res.locals);
	const state = getSessionState(gameId);
	if (!state) {
		res.status(404).json({ error: "Session not loaded" });
		return;
	}

	const floorState = state.floors[state.heroFloorIndex].state;
	const updatedActors = Object.fromEntries(
		Object.entries(floorState.actorsById).map(([id, actor]) => {
			if (id === state.heroId) return [id, actor];
			return [id, { ...actor, hp: 0, alive: false }];
		}),
	);
	const updatedFloorState = { ...floorState, actorsById: updatedActors };
	const updatedFloors = state.floors.map((f, i) =>
		i === state.heroFloorIndex ? { ...f, state: updatedFloorState } : f,
	);
	const newState = { ...state, floors: updatedFloors };

	const persisted = gameStateToPersisted(newState);
	PersistedDynamicStateSchema.parse(persisted);
	await persistDebugSnapshot(gameId, newState.turn, persisted);
	setSessionState(gameId, newState);

	res.json({ ok: true, state: newState });
};

/** POST /api/debug/set-xp — set the hero's XP directly. */
export const setXp: RequestHandler = async (req, res) => {
	const schema = z.object({ xp: z.number().int().min(0) });
	const parsed = schema.safeParse(req.body);
	if (!parsed.success) {
		res.status(400).json({ error: "Body must be { xp: number }" });
		return;
	}

	const gameId = getGameId(res.locals);
	const state = getSessionState(gameId);
	if (!state) {
		res.status(404).json({ error: "Session not loaded" });
		return;
	}

	const hero = getHero(state);
	if (!hero) {
		res.status(400).json({ error: "Hero not found in state" });
		return;
	}

	const updatedHero = { ...hero, xp: parsed.data.xp };
	const floorState = state.floors[state.heroFloorIndex].state;
	const updatedActors = { ...floorState.actorsById, [hero.id]: updatedHero };
	const updatedFloorState = { ...floorState, actorsById: updatedActors };
	const updatedFloors = state.floors.map((f, i) =>
		i === state.heroFloorIndex ? { ...f, state: updatedFloorState } : f,
	);
	const newState = { ...state, floors: updatedFloors };

	const persisted = gameStateToPersisted(newState);
	PersistedDynamicStateSchema.parse(persisted);
	await persistDebugSnapshot(gameId, newState.turn, persisted);
	setSessionState(gameId, newState);

	res.json({ ok: true, state: newState });
};
