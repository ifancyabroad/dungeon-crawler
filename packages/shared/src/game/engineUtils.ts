import type { Direction } from "./actions";
import type { Actor, FloorState, GameState } from "./types";

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
