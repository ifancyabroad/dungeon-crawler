import type { Direction } from "./actions";
import type { Actor, ActorId, FloorState, GameState } from "./types";
import { abilityModifier } from "../combat/dice";
import {
	proficiencyBonusFromChallengeRating,
	proficiencyBonusFromLevel,
} from "../combat/savingThrows";
import { hasActiveEffect } from "../skills";
import { STATUS_HOOKS } from "../config/skills";

export const DIRECTION_DELTA: Record<Direction, { dx: number; dy: number }> = {
	up: { dx: 0, dy: -1 },
	down: { dx: 0, dy: 1 },
	left: { dx: -1, dy: 0 },
	right: { dx: 1, dy: 0 },
	"up-left": { dx: -1, dy: -1 },
	"up-right": { dx: 1, dy: -1 },
	"down-left": { dx: -1, dy: 1 },
	"down-right": { dx: 1, dy: 1 },
};

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
export function actorKind(a: Actor): "hero" | "npc" {
	return a.def.type;
}

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
 * Returns true if a diagonal step (dx, dy) would squeeze through two walls.
 * Blocks only when BOTH adjacent cardinal tiles are impassable — matching DCSS behaviour.
 *   cardinal1 = (originX + dx, originY)
 *   cardinal2 = (originX,      originY + dy)
 */
export function isSqueezeBlocked(
	originX: number,
	originY: number,
	dx: number,
	dy: number,
	width: number,
	height: number,
	walkableMask: Uint8Array,
): boolean {
	const c1x = originX + dx,
		c1y = originY;
	const c2x = originX,
		c2y = originY + dy;
	if (c1x < 0 || c1x >= width || c1y < 0 || c1y >= height) return true;
	if (c2x < 0 || c2x >= width || c2y < 0 || c2y >= height) return true;
	const c1Wall = walkableMask[c1y * width + c1x] !== 1;
	const c2Wall = walkableMask[c2y * width + c2x] !== 1;
	return c1Wall && c2Wall;
}

/** Return all 8 adjacent tile indices (cardinal + diagonal) that are in bounds. */
export function getAdjacentIndices8(idx: number, width: number, height: number): number[] {
	const { x, y } = idxToXY(idx, width);
	const result: number[] = [];
	for (const { dx, dy } of Object.values(DIRECTION_DELTA)) {
		const nx = x + dx,
			ny = y + dy;
		if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
			result.push(ny * width + nx);
		}
	}
	return result;
}

/**
 * Attack modifier for an actor's weapon attack.
 * Finesse weapons use the best of STR/DEX; others use equippedAttackStat.
 */
export function computeAttackMod(actor: Actor): number {
	const strMod = abilityModifier(actor.attributes.strength);
	const dexMod = abilityModifier(actor.attributes.dexterity);
	if (actor.equippedWeaponFinesse) return Math.max(strMod, dexMod);
	return actor.equippedAttackStat === "dexterity" ? dexMod : strMod;
}

/**
 * Proficiency bonus for weapon attacks.
 * Heroes scale with level; NPCs scale with challenge rating.
 * Returns 0 if the actor is not proficient with their equipped weapon.
 */
export function computeWeaponProficiencyBonus(actor: Actor): number {
	if (!actor.weaponProficient) return 0;
	return actor.def.type === "hero"
		? proficiencyBonusFromLevel(actor.level)
		: proficiencyBonusFromChallengeRating(actor.challengeRating ?? 0);
}

/**
 * Compute the target cell for a directional action (move or attack).
 * Returns null if the target is out of bounds.
 */
export function computeTargetCell(
	heroIdx: number,
	direction: Direction,
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

/**
 * If the hero is stealthed, remove the stealth effect and alert all living NPCs
 * to the hero's current position. Called before enemy turns on attack and skill use,
 * so enemies can retaliate immediately after the hero reveals themselves.
 */
export function breakStealth(
	hero: Actor,
	heroId: ActorId,
	floorState: FloorState,
): { hero: Actor; floorState: FloorState } {
	if (!hasActiveEffect(hero, STATUS_HOOKS.STEALTH)) return { hero, floorState };

	const updatedHero: Actor = {
		...hero,
		activeEffects: hero.activeEffects.filter((e) => e.id !== "stealth"),
	};

	let actorsById: Record<string, Actor> = {
		...floorState.actorsById,
		[heroId]: updatedHero,
	};

	for (const [id, actor] of Object.entries(actorsById)) {
		if (id === heroId || !actor.alive || actor.def.type !== "npc" || !actor.aiState) continue;
		actorsById = {
			...actorsById,
			[id]: { ...actor, aiState: { ...actor.aiState!, lastKnownEnemyIdx: hero.idx } },
		};
	}

	return { hero: updatedHero, floorState: { ...floorState, actorsById } };
}

/**
 * Decrement cooldownRemaining by 1 for every skill on every living actor on the hero's floor.
 * Called at the end of every player turn so cooldowns count down with each action.
 */
export function tickSkillCooldowns(state: GameState): GameState {
	const fi = state.heroFloorIndex;
	const floor = state.floors[fi];
	if (!floor) return state;

	let actorsById = floor.state.actorsById;
	for (const [actorId, actor] of Object.entries(actorsById)) {
		if (!actor.alive || Object.keys(actor.skills).length === 0) continue;
		const updatedSkills: Record<string, { rank: number; cooldownRemaining: number }> = {};
		for (const [id, s] of Object.entries(actor.skills)) {
			updatedSkills[id] = {
				...s,
				cooldownRemaining: Math.max(0, s.cooldownRemaining - 1),
			};
		}
		actorsById = { ...actorsById, [actorId]: { ...actor, skills: updatedSkills } };
	}

	const newFloors = state.floors.slice();
	newFloors[fi] = {
		...floor,
		state: { ...floor.state, actorsById },
	};
	return { ...state, floors: newFloors };
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
