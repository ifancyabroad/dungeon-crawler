/**
 * Line-of-sight via symmetric shadow casting.
 *
 * Algorithm: scan 8 octants outward from origin. For each column/row in an
 * octant, track which angular slopes are still unblocked. A cell is visible if
 * any unblocked slope passes through it. Walls are visible (you can see what
 * blocks you) but block everything behind them.
 *
 * Symmetric property: if A can see B then B can see A. This naturally enables
 * corner-peeking when the hero is adjacent to a wall edge.
 */

import { TILE_TYPE } from "./config";

/**
 * Build a flat Uint8Array where 1 = opaque (blocks LoS), 0 = transparent.
 * Only TILE_TYPE.WALL is opaque.
 */
export function computeOpacityMask(wall: number[][], width: number, height: number): Uint8Array {
	const mask = new Uint8Array(width * height);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			mask[y * width + x] = wall[y][x] === TILE_TYPE.WALL ? 1 : 0;
		}
	}
	return mask;
}

/**
 * Compute a visibility mask from (originX, originY) with the given radius.
 * Returns a flat Uint8Array (1 = visible, 0 = not visible).
 */
export function computeVisibility(
	originX: number,
	originY: number,
	width: number,
	height: number,
	opacityMask: Uint8Array,
	radius: number,
): Uint8Array {
	const visible = new Uint8Array(width * height);
	const r2 = radius * radius;

	visible[originY * width + originX] = 1;

	for (let octant = 0; octant < 8; octant++) {
		castOctant(originX, originY, width, height, opacityMask, visible, r2, octant);
	}

	return visible;
}

/**
 * Merge a visibility mask into an explored array.
 * Returns a new array where explored[i] = 1 if it was already explored or is now visible.
 */
export function mergeExplored(existing: number[], visible: Uint8Array, size: number): number[] {
	const result = new Array<number>(size);
	for (let i = 0; i < size; i++) {
		result[i] = (existing[i] ?? 0) || visible[i] ? 1 : 0;
	}
	return result;
}

// ---------------------------------------------------------------------------
// Octant transforms
// ---------------------------------------------------------------------------

/**
 * Each octant maps (row, col) offsets relative to origin into (dx, dy).
 * row = distance from origin along the primary axis,
 * col = distance along the secondary axis.
 */
function transformOctant(octant: number, row: number, col: number): { dx: number; dy: number } {
	switch (octant) {
		case 0:
			return { dx: col, dy: -row };
		case 1:
			return { dx: row, dy: -col };
		case 2:
			return { dx: row, dy: col };
		case 3:
			return { dx: col, dy: row };
		case 4:
			return { dx: -col, dy: row };
		case 5:
			return { dx: -row, dy: col };
		case 6:
			return { dx: -row, dy: -col };
		case 7:
			return { dx: -col, dy: -row };
		default:
			return { dx: 0, dy: 0 };
	}
}

// ---------------------------------------------------------------------------
// Recursive shadow casting per octant
// ---------------------------------------------------------------------------

function castOctant(
	ox: number,
	oy: number,
	width: number,
	height: number,
	opacityMask: Uint8Array,
	visible: Uint8Array,
	r2: number,
	octant: number,
): void {
	castRows(ox, oy, width, height, opacityMask, visible, r2, octant, 1, -1, 1);
}

/**
 * Recursive scan for one octant.
 * startSlope / endSlope define the angular window (range -1..1 mapped to the
 * octant's sweep). We scan column-by-column (row = distance from origin).
 */
function castRows(
	ox: number,
	oy: number,
	width: number,
	height: number,
	opacityMask: Uint8Array,
	visible: Uint8Array,
	r2: number,
	octant: number,
	row: number,
	startSlope: number,
	endSlope: number,
): void {
	if (startSlope >= endSlope) return;

	let nextStartSlope = startSlope;

	for (let currentRow = row; ; currentRow++) {
		if (currentRow * currentRow > r2) return;

		let blocked = false;

		const minCol = Math.round(currentRow * startSlope);
		const maxCol = Math.ceil(currentRow * endSlope - 0.5);

		for (let col = minCol; col <= maxCol; col++) {
			const { dx, dy } = transformOctant(octant, currentRow, col);
			const mx = ox + dx;
			const my = oy + dy;

			if (mx < 0 || mx >= width || my < 0 || my >= height) continue;

			if (dx * dx + dy * dy > r2) continue;

			const idx = my * width + mx;

			const leftSlope = (col - 0.5) / currentRow;
			const rightSlope = (col + 0.5) / currentRow;

			if (rightSlope <= startSlope || leftSlope >= endSlope) continue;

			visible[idx] = 1;

			const isOpaque = opacityMask[idx] === 1;

			if (blocked) {
				if (isOpaque) {
					nextStartSlope = rightSlope;
				} else {
					blocked = false;
					startSlope = nextStartSlope;
				}
			} else if (isOpaque) {
				blocked = true;
				nextStartSlope = rightSlope;
				castRows(
					ox,
					oy,
					width,
					height,
					opacityMask,
					visible,
					r2,
					octant,
					currentRow + 1,
					startSlope,
					leftSlope,
				);
			}
		}

		if (blocked) return;
	}
}
