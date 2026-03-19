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
import { computeWalkableMaskForFloor, regenerateBaseMaps, type BaseLayerFloor } from "../map";
import { computeOpacityMask, computeVisibility, mergeExplored } from "../map/visibility";
import { resolveAttack } from "../combat/combat";
import { computeUnarmoredAC } from "../combat/dice";
import { UNARMED_WEAPON } from "../combat/types";
import { runMonsterAI, type MonsterAIState } from "./monsterAI";
import { resolveSkill, hasStatusEffect, tickStatusEffects } from "../skills";
import type { SkillDefinition } from "../skills";

/** Empty floor state. Use when defaulting or building from persisted. spawnIdx and exitIdx are set after map generation. */
export function createEmptyFloorState(): FloorState {
	return { tileOverrides: {}, actorsById: {}, explored: [], spawnIdx: 0, exitIdx: null };
}

/** Context required for applyAction: walkability + opacity masks per floor, plus content lookups. */
export interface ApplyActionContext {
	getWalkableMask(floorIndex: number): Uint8Array;
	/** 1 = opaque (blocks LoS), 0 = transparent. Required for explored-state updates. */
	getOpacityMask(floorIndex: number): Uint8Array;
	/**
	 * Look up a skill definition by id. Used by the "use_skill" action branch.
	 * Returns undefined if the skill is not found (invalid id → engine rejects the action).
	 * In production, this is backed by skillsById from @app/content.
	 * In tests, pass a map of mock definitions.
	 */
	getSkillDef(skillId: string): SkillDefinition | undefined;
}

/** Build context from precomputed walkability and opacity masks (O(1) per apply). */
export function createActionContext(
	walkableMasks: Uint8Array[],
	opacityMasks: Uint8Array[],
	skillDefs?: Record<string, SkillDefinition>,
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
		getSkillDef(skillId: string): SkillDefinition | undefined {
			return skillDefs?.[skillId];
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
	skills: [],
};

/**
 * Build a single floor's initial state from its base layer.
 * Pass heroInit to populate the hero actor and initial visibility on the spawn tile.
 * Pass null for floors the hero doesn't start on (they'll receive monsters lazily).
 */
function buildInitialFloorState(
	base: BaseLayerFloor,
	config: FloorConfig,
	heroInit: HeroInit | null,
): FloorState {
	const { spawnIdx } = base;
	const exitIdx = base.exitIdx === -1 ? null : base.exitIdx;

	if (!heroInit) {
		return { tileOverrides: {}, actorsById: {}, explored: [], spawnIdx, exitIdx };
	}

	const initialSkills: Record<string, { cooldownRemaining: number }> = {};
	for (const skillId of heroInit.skills ?? []) {
		initialSkills[skillId] = { cooldownRemaining: 0 };
	}

	const heroActor: Actor = {
		id: "hero",
		name: heroInit.name,
		idx: spawnIdx,
		alive: true,
		hp: heroInit.hp,
		maxHp: heroInit.maxHp,
		armorClass: heroInit.armorClass ?? computeUnarmoredAC(heroInit.attributes.dexterity),
		attributes: { ...heroInit.attributes },
		damageResistances: [],
		damageImmunities: [],
		skills: initialSkills,
		statusEffects: [],
		def: { type: "hero", classId: heroInit.classId },
		level: heroInit.level,
		xp: heroInit.xp,
		hitDie: heroInit.hitDie,
		xpReward: 0,
	};

	const { x: spawnX, y: spawnY } = idxToXY(spawnIdx, config.width);
	const opMask = computeOpacityMask(base.wall, config.width, config.height);
	const visible = computeVisibility(
		spawnX,
		spawnY,
		config.width,
		config.height,
		opMask,
		VISION_RADIUS,
	);
	const explored = mergeExplored([], visible, config.width * config.height);

	return {
		tileOverrides: {},
		actorsById: { hero: heroActor } as Record<ActorId, Actor>,
		explored,
		spawnIdx,
		exitIdx,
	};
}

/**
 * Create initial game state: all floors pre-generated, hero on floor 0.
 * Floors 1–N are empty (no actors); monsters are spawned lazily on first visit by the API.
 */
export function createInitialState(
	seed: number,
	floorConfigs: FloorConfig[],
	hero: HeroInit,
): GameState {
	const rngState = createInitialRngState(seed);
	const baseLayers = regenerateBaseMaps(seed, floorConfigs, MAP_GEN_VERSION);

	const floors = floorConfigs.map((config, i) => ({
		config,
		state: buildInitialFloorState(baseLayers[i], config, i === 0 ? hero : null),
	}));

	return {
		turn: 0,
		heroId: "hero",
		heroFloorIndex: 0,
		seed,
		mapGenVersion: MAP_GEN_VERSION,
		floors,
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
	const aiState: MonsterAIState = { strategy: init.aiStrategy };
	const actor: Actor = {
		id: nextMonsterId(init.monsterId),
		name: init.name,
		idx,
		alive: true,
		hp: init.hp,
		maxHp: init.maxHp,
		armorClass: init.armorClass,
		attributes: { ...init.attributes },
		damageResistances: [...init.damageResistances],
		damageImmunities: [...init.damageImmunities],
		skills: {},
		statusEffects: [],
		def: { type: "monster", monsterId: init.monsterId },
		level: 0,
		xp: 0,
		hitDie: 0,
		xpReward: init.xpReward,
		aiState,
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
 * Award XP to an actor for a kill, levelling them up if the threshold is crossed.
 * Returns the updated actor and any level_up events emitted.
 */
function grantXpForKill(
	actor: Actor,
	actorId: ActorId,
	xpReward: number,
	rng: Rng,
): { actor: Actor; events: GameEvent[] } {
	if (xpReward <= 0) return { actor, events: [] };
	const events: GameEvent[] = [];
	let newXp = actor.xp + xpReward;
	let newLevel = actor.level;
	let newMaxHp = actor.maxHp;
	let newCurrentHp = actor.hp;

	const nextLevelXp = XP_PER_LEVEL[newLevel + 1] ?? Infinity;
	if (newXp >= nextLevelXp) {
		newXp -= nextLevelXp;
		newLevel += 1;
		const conMod = Math.floor((actor.attributes.constitution - 10) / 2);
		const roll = Math.floor(rng() * actor.hitDie) + 1;
		const hpGained = Math.max(1, roll + conMod);
		newMaxHp += hpGained;
		newCurrentHp += hpGained;
		events.push({ type: "level_up", actorId, newLevel, hpGained });
	}

	return {
		actor: { ...actor, xp: newXp, level: newLevel, maxHp: newMaxHp, hp: newCurrentHp },
		events,
	};
}

/**
 * After a player action, each living monster on the hero's floor acts.
 * Each monster runs its AI strategy: chase/roam/attack/skill based on LoS.
 * Sorted by actor ID for deterministic order.
 * `getSkillDef` is required to resolve monster skill actions.
 */
function processEnemyTurns(
	floorState: FloorState,
	heroId: ActorId,
	width: number,
	height: number,
	walkableMask: Uint8Array,
	opacityMask: Uint8Array,
	rng: Rng,
	getSkillDef: (skillId: string) => SkillDefinition | undefined,
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
	// If the hero is stealthed, monsters cannot see them regardless of LoS.
	const heroIsStealthed = hasStatusEffect(currentHero, "stealth");

	for (const mid of monsterIds) {
		if (!currentHero.alive) break;
		const monster = actorsById[mid];

		// Monsters without aiState are inert (shouldn't happen in normal play)
		const aiState = monster.aiState;
		if (!aiState) continue;

		const { x, y } = idxToXY(monster.idx, width);
		let visibleFromMonster = computeVisibility(x, y, width, height, opacityMask, VISION_RADIUS);

		// Stealth: mask hero tile so all AI strategies treat the hero as invisible.
		if (heroIsStealthed) {
			visibleFromMonster = visibleFromMonster.slice() as Uint8Array;
			visibleFromMonster[currentHero.idx] = 0;
		}

		// Build a temporary floor state snapshot so AI sees the current actor positions
		const currentFloorState: FloorState = { ...floorState, actorsById };

		const { result, newAIState } = runMonsterAI({
			monster,
			aiState,
			hero: currentHero,
			heroId,
			visibleFromMonster,
			walkableMask,
			floorState: currentFloorState,
			width,
			height,
			rng,
		});

		if (result.kind === "attack") {
			const attackResult = resolveAttack(monster, currentHero, rng, UNARMED_WEAPON);
			events.push({
				type: "attack",
				attackerId: mid,
				defenderId: heroId,
				result: attackResult,
			});

			if (attackResult.hit) {
				const newHp = Math.max(0, currentHero.hp - attackResult.damage);
				currentHero = { ...currentHero, hp: newHp, alive: newHp > 0 };
				actorsById = {
					...actorsById,
					[heroId]: currentHero,
					[mid]: { ...monster, aiState: newAIState },
				};
				if (!currentHero.alive) {
					events.push({ type: "death", actorId: heroId });
				}
			} else {
				actorsById = { ...actorsById, [mid]: { ...monster, aiState: newAIState } };
			}
		} else if (result.kind === "move") {
			actorsById = {
				...actorsById,
				[mid]: { ...monster, idx: result.toIdx, aiState: newAIState },
			};
		} else if (result.kind === "skill") {
			// Monster uses a skill — resolved the same way as hero skills.
			const skillDef = getSkillDef(result.skillId);
			const skillState = monster.skills?.[result.skillId];
			if (skillDef && skillState && skillState.cooldownRemaining === 0) {
				const currentFloorSnapshot: FloorState = { ...floorState, actorsById };
				const resolution = resolveSkill({
					skillDef,
					caster: { ...monster, aiState: newAIState },
					casterId: mid,
					floorState: currentFloorSnapshot,
					width,
					height,
					rng,
					targetTileIdx: result.targetTileIdx,
					targetActorId: result.targetActorId,
				});
				if (!("error" in resolution)) {
					const monsterAfterSkill = resolution.floorState.actorsById[mid];
					if (monsterAfterSkill) {
						actorsById = {
							...resolution.floorState.actorsById,
							[mid]: {
								...monsterAfterSkill,
								skills: {
									...monsterAfterSkill.skills,
									[result.skillId]: { cooldownRemaining: skillDef.cooldown },
								},
							},
						};
					} else {
						actorsById = resolution.floorState.actorsById;
					}
					events.push(...resolution.events);
					const heroAfterSkill = actorsById[heroId];
					if (heroAfterSkill) currentHero = heroAfterSkill;
					if (!currentHero.alive) break;
				} else {
					actorsById = { ...actorsById, [mid]: { ...monster, aiState: newAIState } };
				}
			} else {
				// Skill on cooldown or unknown — fall back to idle
				actorsById = { ...actorsById, [mid]: { ...monster, aiState: newAIState } };
			}
		} else {
			// idle — just persist updated aiState (e.g. cleared lastKnownHeroIdx)
			actorsById = { ...actorsById, [mid]: { ...monster, aiState: newAIState } };
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
 * Decrement cooldownRemaining by 1 for every skill on the hero, removing any that reach 0.
 * Called at the end of every player turn so cooldowns count down with each action.
 */
function tickSkillCooldowns(state: GameState): GameState {
	const fi = state.heroFloorIndex;
	const floor = state.floors[fi];
	if (!floor) return state;
	const hero = floor.state.actorsById[state.heroId];
	if (!hero) return state;

	const updatedSkills: Record<string, { level?: number; cooldownRemaining: number }> = {};
	for (const [id, s] of Object.entries(hero.skills)) {
		updatedSkills[id] = {
			...s,
			cooldownRemaining: Math.max(0, s.cooldownRemaining - 1),
		};
	}

	const updatedHero: Actor = { ...hero, skills: updatedSkills };
	const newFloors = state.floors.slice();
	newFloors[fi] = {
		...floor,
		state: {
			...floor.state,
			actorsById: { ...floor.state.actorsById, [state.heroId]: updatedHero },
		},
	};
	return { ...state, floors: newFloors };
}

/**
 * If the hero is stealthed, remove the stealth effect and alert all living monsters
 * to the hero's current position. Called before enemy turns on attack and skill use,
 * so enemies can retaliate immediately after the hero reveals themselves.
 */
function breakStealth(
	hero: Actor,
	heroId: ActorId,
	floorState: FloorState,
): { hero: Actor; floorState: FloorState } {
	if (!hasStatusEffect(hero, "stealth")) return { hero, floorState };

	const updatedHero: Actor = {
		...hero,
		statusEffects: hero.statusEffects.filter((e) => e.id !== "stealth"),
	};

	let actorsById: Record<string, Actor> = {
		...floorState.actorsById,
		[heroId]: updatedHero,
	};

	for (const [id, actor] of Object.entries(actorsById)) {
		if (id === heroId || !actor.alive || actor.def.type !== "monster" || !actor.aiState)
			continue;
		actorsById = {
			...actorsById,
			[id]: { ...actor, aiState: { ...actor.aiState!, lastKnownHeroIdx: hero.idx } },
		};
	}

	return { hero: updatedHero, floorState: { ...floorState, actorsById } };
}

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

			// Enemy turns on current floor (before potential descend)
			const { rng, getState: getRngState } = createRngFromState(state.rngState);
			const enemyResult = processEnemyTurns(
				newFloorState,
				state.heroId,
				width,
				height,
				mask,
				opacityMask,
				rng,
				context.getSkillDef,
			);
			newFloorState = enemyResult.floorState;

			const newFloors = state.floors.slice();
			newFloors[fi] = { ...floor, state: newFloorState };

			let newState: GameState = {
				...state,
				turn: state.turn + 1,
				floors: newFloors,
				rngState: getRngState(),
			};
			const events: GameEvent[] = [...enemyResult.events];

			// Auto-descend: hero stepped onto the exit tile and a next floor exists
			const heroAfterMove = newFloorState.actorsById[state.heroId];
			if (
				heroAfterMove?.alive &&
				floor.state.exitIdx !== null &&
				newIdx === floor.state.exitIdx &&
				fi < state.floors.length - 1
			) {
				const nextFi = fi + 1;
				const nextFloor = newState.floors[nextFi];
				if (nextFloor) {
					// Remove hero from current floor, place on next floor at spawn
					const departingFloorState: FloorState = {
						...newFloorState,
						actorsById: Object.fromEntries(
							Object.entries(newFloorState.actorsById).filter(
								([id]) => id !== state.heroId,
							),
						),
					};
					const descendingHero: Actor = {
						...heroAfterMove,
						idx: nextFloor.state.spawnIdx,
					};

					// Compute initial visibility on next floor
					const nextWidth = nextFloor.config.width;
					const nextHeight = nextFloor.config.height;
					const nextOpMask = context.getOpacityMask(nextFi);
					const { x: spawnX, y: spawnY } = idxToXY(nextFloor.state.spawnIdx, nextWidth);
					const nextVisible = computeVisibility(
						spawnX,
						spawnY,
						nextWidth,
						nextHeight,
						nextOpMask,
						VISION_RADIUS,
					);
					const nextExplored = mergeExplored(
						nextFloor.state.explored,
						nextVisible,
						nextWidth * nextHeight,
					);

					const nextFloorState: FloorState = {
						...nextFloor.state,
						actorsById: {
							...nextFloor.state.actorsById,
							[state.heroId]: descendingHero,
						},
						explored: nextExplored,
					};

					const descendFloors = newState.floors.slice();
					descendFloors[fi] = { ...newState.floors[fi], state: departingFloorState };
					descendFloors[nextFi] = { ...nextFloor, state: nextFloorState };

					events.push({ type: "descend", fromFloor: fi, toFloor: nextFi });

					newState = {
						...newState,
						heroFloorIndex: nextFi,
						floors: descendFloors,
					};
				}
			}

			newState = tickStatusEffects(newState);
			newState = tickSkillCooldowns(newState);

			return { ok: true, state: newState, events };
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

			// Attacking breaks stealth — hero is revealed before enemy turns.
			const { hero: heroAfterBreak, floorState: floorAfterBreak } = breakStealth(
				hero,
				state.heroId,
				floor.state,
			);
			const activeHero = heroAfterBreak;
			const activeFloorState = floorAfterBreak;

			// Hero attacks enemy
			const attackResult = resolveAttack(activeHero, defender, rng, UNARMED_WEAPON);
			events.push({
				type: "attack",
				attackerId: state.heroId,
				defenderId: defender.id,
				result: attackResult,
			});

			let updatedHero: Actor = activeHero;
			let updatedDefender: Actor | undefined;
			if (attackResult.hit) {
				const newHp = Math.max(0, defender.hp - attackResult.damage);
				updatedDefender = { ...defender, hp: newHp, alive: newHp > 0 };
				if (!updatedDefender.alive) {
					events.push({ type: "death", actorId: defender.id });
					const { actor: heroWithXp, events: xpEvents } = grantXpForKill(
						activeHero,
						state.heroId,
						defender.xpReward,
						rng,
					);
					updatedHero = heroWithXp;
					events.push(...xpEvents);
				}
			}
			const newActorsById = {
				...activeFloorState.actorsById,
				[state.heroId]: updatedHero,
				...(updatedDefender ? { [defender.id]: updatedDefender } : {}),
			};

			let newFloorState: FloorState = { ...activeFloorState, actorsById: newActorsById };

			// Enemy turns after attack
			const attackWalkMask = context.getWalkableMask(fi);
			const attackOpacityMask = context.getOpacityMask(fi);
			const enemyResult = processEnemyTurns(
				newFloorState,
				state.heroId,
				width,
				height,
				attackWalkMask,
				attackOpacityMask,
				rng,
				context.getSkillDef,
			);
			newFloorState = enemyResult.floorState;
			events.push(...enemyResult.events);

			const newFloors = state.floors.slice();
			newFloors[fi] = { ...floor, state: newFloorState };

			let attackNewState: GameState = {
				...state,
				turn: state.turn + 1,
				floors: newFloors,
				rngState: getRngState(),
			};
			attackNewState = tickStatusEffects(attackNewState);
			attackNewState = tickSkillCooldowns(attackNewState);

			return { ok: true, state: attackNewState, events };
		}

		case "use_skill": {
			const hero = getHero(state);
			if (!hero || !hero.alive) return { ok: false, reason: "skill_no_hero" };
			const fi = state.heroFloorIndex;
			const floor = state.floors[fi];
			if (!floor) return { ok: false, reason: "skill_no_floor" };

			const skillDef = context.getSkillDef(action.skillId);
			if (!skillDef) return { ok: false, reason: "skill_unknown" };

			// Validate that the hero has this skill (it was awarded at creation)
			const skillState = hero.skills[action.skillId];
			if (!skillState) return { ok: false, reason: "skill_not_owned" };
			if (skillState.cooldownRemaining > 0) return { ok: false, reason: "skill_on_cooldown" };

			const width = floor.config.width;
			const height = floor.config.height;
			const { rng, getState: getRngState } = createRngFromState(state.rngState);

			// Using a skill that doesn't explicitly maintain stealth reveals the hero.
			const { hero: heroForSkill, floorState: floorForSkill } = !skillDef.maintainsStealth
				? breakStealth(hero, state.heroId, floor.state)
				: { hero, floorState: floor.state };

			const resolution = resolveSkill({
				skillDef,
				caster: heroForSkill,
				casterId: state.heroId,
				floorState: floorForSkill,
				width,
				height,
				rng,
				targetTileIdx: action.targetTileIdx,
				targetActorId: action.targetActorId,
			});

			if ("error" in resolution) return { ok: false, reason: resolution.error };

			// Set cooldown on the caster (hero)
			const heroAfterSkill: Actor = {
				...resolution.caster,
				skills: {
					...resolution.caster.skills,
					[action.skillId]: { ...skillState, cooldownRemaining: skillDef.cooldown },
				},
			};

			let newFloorState: FloorState = {
				...resolution.floorState,
				actorsById: {
					...resolution.floorState.actorsById,
					[state.heroId]: heroAfterSkill,
				},
			};

			// Grant XP for any kills caused by the skill
			let updatedHero = heroAfterSkill;
			const skillXpEvents: GameEvent[] = [];
			for (const event of resolution.events) {
				if (event.type === "death") {
					const dead = newFloorState.actorsById[event.actorId];
					if (dead?.def.type === "monster") {
						const { actor: heroWithXp, events: xpEvents } = grantXpForKill(
							updatedHero,
							state.heroId,
							dead.xpReward,
							rng,
						);
						updatedHero = heroWithXp;
						skillXpEvents.push(...xpEvents);
					}
				}
			}

			// Re-sync updated hero (XP/level may have changed) and emit XP events
			newFloorState = {
				...newFloorState,
				actorsById: { ...newFloorState.actorsById, [state.heroId]: updatedHero },
			};

			// Enemy turns
			const skillWalkMask = context.getWalkableMask(fi);
			const skillOpacityMask = context.getOpacityMask(fi);
			const enemyResult = processEnemyTurns(
				newFloorState,
				state.heroId,
				width,
				height,
				skillWalkMask,
				skillOpacityMask,
				rng,
				context.getSkillDef,
			);
			newFloorState = enemyResult.floorState;

			const newFloors = state.floors.slice();
			newFloors[fi] = { ...floor, state: newFloorState };

			// Tick down status effects and cooldowns at end of turn
			let newState: GameState = tickStatusEffects({
				...state,
				turn: state.turn + 1,
				floors: newFloors,
				rngState: getRngState(),
			});

			// Decrement all skill cooldowns on the hero
			newState = tickSkillCooldowns(newState);

			return {
				ok: true,
				state: newState,
				events: [...resolution.events, ...skillXpEvents, ...enemyResult.events],
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
