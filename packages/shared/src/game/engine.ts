/**
 * Deterministic game engine: create initial state and apply actions.
 * Walkability: pass via context.getWalkableMask (required in production; use applyActionWithDerivedContext for dev/test).
 * RNG state is only advanced when an action actually uses RNG (e.g. future spawns/combat).
 */

import type { Action } from "./actions";
import type {
	Actor,
	ActorId,
	FloorConfig,
	FloorState,
	GameEvent,
	GameState,
	HeroInit,
	MonsterInit,
} from "./types";
import type { PersistedDynamicState } from "./types";
import { MAP_GEN_VERSION } from "./types";
import { VISION_RADIUS, XP_PER_LEVEL } from "./config";
import { createInitialRngState, createRngFromState, type Rng } from "../rng";
import { computeWalkableMaskForFloor, regenerateBaseMaps } from "../map";
import { computeOpacityMask, computeVisibility, mergeExplored } from "../map/visibility";
import { resolveAttack } from "../combat/combat";
import { computeUnarmoredAC } from "../combat/dice";
import { UNARMED_WEAPON } from "../combat/types";

/** Empty floor state (tileOverrides, actorsById, explored). Use when defaulting or building from persisted. */
export function createEmptyFloorState(): FloorState {
	return { tileOverrides: {}, actorsById: {}, explored: [] };
}

/** Context required for applyAction: walkability + opacity masks per floor. */
export interface ApplyActionContext {
	getWalkableMask(floorIndex: number): Uint8Array;
	/** 1 = opaque (blocks LoS), 0 = transparent. Required for explored-state updates. */
	getOpacityMask(floorIndex: number): Uint8Array;
}

/** Build context from precomputed walkability and opacity masks (O(1) per apply). */
export function createActionContext(
	walkableMasks: Uint8Array[],
	opacityMasks: Uint8Array[],
): ApplyActionContext {
	return {
		getWalkableMask(fi: number): Uint8Array {
			const mask = walkableMasks[fi];
			if (mask === undefined) {
				throw new Error(`createActionContext: missing walkability mask for floor ${fi}`);
			}
			return mask;
		},
		getOpacityMask(fi: number): Uint8Array {
			const mask = opacityMasks[fi];
			if (mask === undefined) {
				throw new Error(`createActionContext: missing opacity mask for floor ${fi}`);
			}
			return mask;
		},
	};
}

const DIRECTION_DELTA: Record<"up" | "down" | "left" | "right", { dx: number; dy: number }> = {
	up: { dx: 0, dy: -1 },
	down: { dx: 0, dy: 1 },
	left: { dx: -1, dy: 0 },
	right: { dx: 1, dy: 0 },
};

export type ApplyActionResult =
	| { ok: true; state: GameState; events: GameEvent[] }
	| { ok: false; reason: string };

/** Convert linear index to x,y. idx = y * width + x. */
export function idxToXY(idx: number, width: number): { x: number; y: number } {
	const x = idx % width;
	const y = Math.floor(idx / width);
	return { x, y };
}

/** Convert x,y to linear index. idx = y * width + x. */
export function xyToIdx(x: number, y: number, width: number): number {
	return y * width + x;
}

/** Get the hero actor from state. Hero floor is state.heroFloorIndex; hero id is state.heroId. */
export function getHero(state: GameState): Actor | undefined {
	return state.floors[state.heroFloorIndex]?.state.actorsById[state.heroId];
}

/** Actor "kind" is def.type. Use this instead of a removed .kind field. */
export function actorKind(a: Actor): "hero" | "monster" {
	return a.def.type;
}

const DEFAULT_ATTRIBUTES = {
	strength: 10,
	dexterity: 10,
	constitution: 10,
	intelligence: 10,
	wisdom: 10,
	charisma: 10,
} as const;

/** Fallback hero init for tests and debug. Matches legacy hardcoded warrior. */
export const DEFAULT_HERO_INIT: HeroInit = {
	name: "Hero",
	classId: "warrior",
	hp: 100,
	maxHp: 100,
	attributes: { ...DEFAULT_ATTRIBUTES },
	level: 1,
	xp: 0,
	hitDie: 10,
};

/**
 * Create initial game state: one floor, hero actor at spawn, rngState from seed.
 * Computes initial explored tiles from spawn visibility.
 */
export function createInitialState(
	seed: number,
	floorConfig: FloorConfig,
	hero: HeroInit,
): GameState {
	const rngState = createInitialRngState(seed);
	const floorConfigs: FloorConfig[] = [floorConfig];
	const baseLayers = regenerateBaseMaps(seed, floorConfigs, MAP_GEN_VERSION);
	const floor0 = baseLayers[0];
	const width = floorConfig.width;
	const height = floorConfig.height;
	const spawnIdx = xyToIdx(floor0.spawn.x, floor0.spawn.y, width);

	const heroActor: Actor = {
		id: "hero",
		name: hero.name,
		idx: spawnIdx,
		alive: true,
		hp: hero.hp,
		maxHp: hero.maxHp,
		armorClass: hero.armorClass ?? computeUnarmoredAC(hero.attributes.dexterity),
		attributes: { ...hero.attributes },
		skills: {},
		def: { type: "hero", classId: hero.classId },
		level: hero.level,
		xp: hero.xp,
		hitDie: hero.hitDie,
		xpReward: 0,
	};

	const opMask = computeOpacityMask(floor0.wall, width, height);
	const visible = computeVisibility(
		floor0.spawn.x,
		floor0.spawn.y,
		width,
		height,
		opMask,
		VISION_RADIUS,
	);
	const explored = mergeExplored([], visible, width * height);

	const floorState: FloorState = {
		...createEmptyFloorState(),
		actorsById: { hero: heroActor } as Record<ActorId, Actor>,
		explored,
	};

	return {
		turn: 0,
		heroId: "hero",
		heroFloorIndex: 0,
		seed,
		mapGenVersion: MAP_GEN_VERSION,
		floors: [{ config: floorConfig, state: floorState }],
		rngState,
	};
}

// ---------------------------------------------------------------------------
// Actor / tile helpers
// ---------------------------------------------------------------------------

/** Find the first living actor at a given tile index on a floor. */
export function getActorAtIdx(floorState: FloorState, idx: number): Actor | undefined {
	for (const actor of Object.values(floorState.actorsById)) {
		if (actor.alive && actor.idx === idx) return actor;
	}
	return undefined;
}

/** Return the 4 cardinal-adjacent tile indices that are in bounds. */
export function getAdjacentIndices(idx: number, width: number, height: number): number[] {
	const { x, y } = idxToXY(idx, width);
	const result: number[] = [];
	if (x > 0) result.push(xyToIdx(x - 1, y, width));
	if (x < width - 1) result.push(xyToIdx(x + 1, y, width));
	if (y > 0) result.push(xyToIdx(x, y - 1, width));
	if (y < height - 1) result.push(xyToIdx(x, y + 1, width));
	return result;
}

/**
 * Find a walkable, unoccupied tile adjacent to `originIdx`.
 * Returns undefined if none available.
 */
export function findAdjacentWalkable(
	originIdx: number,
	width: number,
	height: number,
	walkableMask: Uint8Array,
	floorState: FloorState,
): number | undefined {
	const candidates = getAdjacentIndices(originIdx, width, height);
	for (const idx of candidates) {
		if (walkableMask[idx] === 1 && !getActorAtIdx(floorState, idx)) return idx;
	}
	return undefined;
}

/** Generate a deterministic actor ID for a monster spawn. */
let _monsterCounter = 0;
export function resetMonsterCounter(): void {
	_monsterCounter = 0;
}
function nextMonsterId(monsterId: string): string {
	return `${monsterId}_${_monsterCounter++}`;
}

/** Spawn a monster on a floor and return the updated state. */
export function spawnMonster(
	state: GameState,
	floorIndex: number,
	init: MonsterInit,
	idx: number,
): GameState {
	const floor = state.floors[floorIndex];
	if (!floor) return state;
	const actor: Actor = {
		id: nextMonsterId(init.monsterId),
		name: init.name,
		idx,
		alive: true,
		hp: init.hp,
		maxHp: init.maxHp,
		armorClass: init.armorClass,
		attributes: { ...init.attributes },
		skills: {},
		def: { type: "monster", monsterId: init.monsterId },
		level: 0,
		xp: 0,
		hitDie: 0,
		xpReward: init.xpReward,
	};
	const newActorsById = { ...floor.state.actorsById, [actor.id]: actor };
	const newFloorState: FloorState = { ...floor.state, actorsById: newActorsById };
	const newFloors = state.floors.slice();
	newFloors[floorIndex] = { ...floor, state: newFloorState };
	return { ...state, floors: newFloors };
}

// ---------------------------------------------------------------------------
// Enemy turn processing
// ---------------------------------------------------------------------------

/**
 * After a player action, each living monster on the hero's floor acts.
 * Static enemies: attack if adjacent to hero, otherwise do nothing.
 * Sorted by actor ID for deterministic order.
 */
function processEnemyTurns(
	floorState: FloorState,
	heroId: ActorId,
	width: number,
	height: number,
	rng: Rng,
): { floorState: FloorState; events: GameEvent[] } {
	const events: GameEvent[] = [];
	let actorsById = { ...floorState.actorsById };
	const hero = actorsById[heroId];
	if (!hero || !hero.alive) return { floorState, events };

	const monsterIds = Object.keys(actorsById)
		.filter(
			(id) => id !== heroId && actorsById[id].alive && actorsById[id].def.type === "monster",
		)
		.sort();

	let currentHero = hero;
	for (const mid of monsterIds) {
		if (!currentHero.alive) break;
		const monster = actorsById[mid];
		const adj = getAdjacentIndices(currentHero.idx, width, height);
		if (!adj.includes(monster.idx)) continue;

		const result = resolveAttack(monster, currentHero, rng, UNARMED_WEAPON);
		events.push({ type: "attack", attackerId: mid, defenderId: heroId, result });

		if (result.hit) {
			const newHp = Math.max(0, currentHero.hp - result.damage);
			currentHero = { ...currentHero, hp: newHp, alive: newHp > 0 };
			actorsById = { ...actorsById, [heroId]: currentHero };
			if (!currentHero.alive) {
				events.push({ type: "death", actorId: heroId });
			}
		}
	}

	return { floorState: { ...floorState, actorsById }, events };
}

// ---------------------------------------------------------------------------
// Compute target cell from direction
// ---------------------------------------------------------------------------

function computeTargetCell(
	heroIdx: number,
	direction: "up" | "down" | "left" | "right",
	width: number,
	height: number,
): { nx: number; ny: number; newIdx: number } | null {
	const { x, y } = idxToXY(heroIdx, width);
	const { dx, dy } = DIRECTION_DELTA[direction];
	const nx = x + dx;
	const ny = y + dy;
	if (nx < 0 || nx >= width || ny < 0 || ny >= height) return null;
	return { nx, ny, newIdx: xyToIdx(nx, ny, width) };
}

// ---------------------------------------------------------------------------
// Apply action
// ---------------------------------------------------------------------------

/**
 * Apply one action to state. Context is required (use applyActionWithDerivedContext in dev/test only).
 * RNG is advanced only when the action involves combat.
 * After every successful player action, enemy turns are processed.
 */
export function applyAction(
	state: GameState,
	action: Action,
	context: ApplyActionContext,
): ApplyActionResult {
	switch (action.type) {
		case "move": {
			const hero = getHero(state);
			if (!hero || !hero.alive) return { ok: false, reason: "move_no_hero" };
			const fi = state.heroFloorIndex;
			const floor = state.floors[fi];
			if (!floor) return { ok: false, reason: "move_no_floor" };
			const width = floor.config.width;
			const height = floor.config.height;
			const size = width * height;
			const mask = context.getWalkableMask(fi);

			const target = computeTargetCell(hero.idx, action.direction, width, height);
			if (!target) return { ok: false, reason: "move_out_of_bounds" };
			const { nx, ny, newIdx } = target;
			if (newIdx < 0 || newIdx >= size || mask[newIdx] !== 1) {
				return { ok: false, reason: "move_blocked" };
			}
			if (getActorAtIdx(floor.state, newIdx)) {
				return { ok: false, reason: "move_blocked_by_enemy" };
			}

			const updatedHero: Actor = { ...hero, idx: newIdx };
			const newActorsById = { ...floor.state.actorsById, [state.heroId]: updatedHero };

			const opacityMask = context.getOpacityMask(fi);
			const visible = computeVisibility(nx, ny, width, height, opacityMask, VISION_RADIUS);
			const explored = mergeExplored(floor.state.explored, visible, size);

			let newFloorState: FloorState = { ...floor.state, actorsById: newActorsById, explored };

			// Enemy turns after move
			const { rng, getState: getRngState } = createRngFromState(state.rngState);
			const enemyResult = processEnemyTurns(newFloorState, state.heroId, width, height, rng);
			newFloorState = enemyResult.floorState;

			const newFloors = state.floors.slice();
			newFloors[fi] = { ...floor, state: newFloorState };

			return {
				ok: true,
				state: {
					...state,
					turn: state.turn + 1,
					floors: newFloors,
					rngState: enemyResult.events.length > 0 ? getRngState() : state.rngState,
				},
				events: enemyResult.events,
			};
		}

		case "attack": {
			const hero = getHero(state);
			if (!hero || !hero.alive) return { ok: false, reason: "attack_no_hero" };
			const fi = state.heroFloorIndex;
			const floor = state.floors[fi];
			if (!floor) return { ok: false, reason: "attack_no_floor" };
			const width = floor.config.width;
			const height = floor.config.height;

			const target = computeTargetCell(hero.idx, action.direction, width, height);
			if (!target) return { ok: false, reason: "attack_out_of_bounds" };

			const defender = getActorAtIdx(floor.state, target.newIdx);
			if (!defender) return { ok: false, reason: "attack_no_target" };

			const { rng, getState: getRngState } = createRngFromState(state.rngState);
			const events: GameEvent[] = [];

			// Hero attacks enemy
			const attackResult = resolveAttack(hero, defender, rng, UNARMED_WEAPON);
			events.push({
				type: "attack",
				attackerId: state.heroId,
				defenderId: defender.id,
				result: attackResult,
			});

			let updatedHero: Actor = hero;
			let updatedDefender: Actor | undefined;
			if (attackResult.hit) {
				const newHp = Math.max(0, defender.hp - attackResult.damage);
				updatedDefender = { ...defender, hp: newHp, alive: newHp > 0 };
				if (!updatedDefender.alive) {
					events.push({ type: "death", actorId: defender.id });

					// Grant XP to the hero
					const gainedXp = defender.xpReward;
					if (gainedXp > 0) {
						let newXp = hero.xp + gainedXp;
						let newLevel = hero.level;
						let newMaxHp = hero.maxHp;
						let newCurrentHp = hero.hp;

						// Check for level-up (can only level up once per kill in practice, but loop for safety)
						const nextLevelXp = XP_PER_LEVEL[newLevel + 1] ?? Infinity;
						if (newXp >= nextLevelXp) {
							newXp -= nextLevelXp;
							newLevel += 1;
							// Roll hit die + CON modifier, minimum 1
							const conMod = Math.floor((hero.attributes.constitution - 10) / 2);
							const roll = Math.floor(rng() * hero.hitDie) + 1;
							const hpGained = Math.max(1, roll + conMod);
							newMaxHp += hpGained;
							newCurrentHp += hpGained;
							events.push({
								type: "level_up",
								actorId: state.heroId,
								newLevel,
								hpGained,
							});
						}

						updatedHero = {
							...hero,
							xp: newXp,
							level: newLevel,
							maxHp: newMaxHp,
							hp: newCurrentHp,
						};
					}
				}
			}
			const newActorsById = {
				...floor.state.actorsById,
				[state.heroId]: updatedHero,
				...(updatedDefender ? { [defender.id]: updatedDefender } : {}),
			};

			let newFloorState: FloorState = { ...floor.state, actorsById: newActorsById };

			// Enemy turns after attack
			const enemyResult = processEnemyTurns(newFloorState, state.heroId, width, height, rng);
			newFloorState = enemyResult.floorState;
			events.push(...enemyResult.events);

			const newFloors = state.floors.slice();
			newFloors[fi] = { ...floor, state: newFloorState };

			return {
				ok: true,
				state: {
					...state,
					turn: state.turn + 1,
					floors: newFloors,
					rngState: getRngState(),
				},
				events,
			};
		}

		case "unknown":
			return { ok: false, reason: "unknown_action" };
		default: {
			const _exhaustive: never = action;
			void _exhaustive;
			return { ok: false, reason: "unknown_action" };
		}
	}
}

/**
 * Dev/test only: build context from state (regenerateBaseMaps + masks per floor) and apply action.
 * Do not use in production API; production must pass context from cache.
 */
export function applyActionWithDerivedContext(state: GameState, action: Action): ApplyActionResult {
	const baseLayers = regenerateBaseMaps(
		state.seed,
		state.floors.map((f) => f.config),
		state.mapGenVersion,
	);
	const walkableMasks = baseLayers.map((base, i) =>
		computeWalkableMaskForFloor(base, state.floors[i]?.state.tileOverrides ?? {}),
	);
	const opacityMasks = baseLayers.map((base) =>
		computeOpacityMask(base.wall, base.width, base.height),
	);
	const context = createActionContext(walkableMasks, opacityMasks);
	return applyAction(state, action, context);
}

/**
 * Build full GameState from persisted dynamic state + session metadata.
 * No walkableByFloor on returned state.
 */
export function buildGameStateFromPersisted(
	seed: number,
	mapGenVersion: number,
	floorConfigs: FloorConfig[],
	persisted: PersistedDynamicState,
): GameState {
	const defaultFloorState = createEmptyFloorState();
	const floors = floorConfigs.map((config, i) => ({
		config,
		state: persisted.floors[i] ?? defaultFloorState,
	}));
	return {
		turn: persisted.turn,
		heroId: persisted.heroId,
		heroFloorIndex: persisted.heroFloorIndex,
		seed,
		mapGenVersion,
		floors,
		rngState: persisted.rngState,
	};
}

/** Convert full GameState to persisted dynamic state (for snapshots). Single source of truth for the shape. */
export function gameStateToPersisted(state: GameState): PersistedDynamicState {
	return {
		turn: state.turn,
		heroId: state.heroId,
		heroFloorIndex: state.heroFloorIndex,
		floors: state.floors.map((f) => f.state),
		rngState: state.rngState,
	};
}
