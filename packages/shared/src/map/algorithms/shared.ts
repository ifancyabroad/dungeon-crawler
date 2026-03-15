/**
 * Shared shape-mask builder used by all map generation algorithms.
 * Produces an irregular playable boundary via bilinear-interpolated noise + radial falloff.
 */

import type { Rng } from "../../rng";

/**
 * Build a boolean playable-shape mask. True = cell is inside the playable area.
 *
 * Two octaves of bilinearly-interpolated coherent noise combined with a radial falloff:
 * - Coarse octave (4×4): ensures large connected blobs.
 * - Fine octave (10×10): adds interior voids, tunnels, and rough edges.
 *
 * The center-connected flood-filled component is returned. If the result is too small
 * (< 20% of map area) an ellipse fallback is used, consuming the same RNG budget.
 */
export function buildShapeMask(
	width: number,
	height: number,
	voidTarget: number,
	rng: Rng,
): boolean[][] {
	const cx = (width - 1) / 2;
	const cy = (height - 1) / 2;
	const scx = Math.floor(cx);
	const scy = Math.floor(cy);

	function sampleGrid(gridW: number, gridH: number): number[][] {
		const grid: number[][] = Array.from({ length: gridH + 1 }, () =>
			Array.from({ length: gridW + 1 }, () => rng()),
		);
		return Array.from({ length: height }, (_, y) =>
			Array.from({ length: width }, (_, x) => {
				const gx = (x / (width - 1)) * gridW;
				const gy = (y / (height - 1)) * gridH;
				const x0 = Math.floor(gx);
				const x1 = Math.min(x0 + 1, gridW);
				const y0 = Math.floor(gy);
				const y1 = Math.min(y0 + 1, gridH);
				const fx = gx - x0;
				const fy = gy - y0;
				return (
					grid[y0][x0] * (1 - fx) * (1 - fy) +
					grid[y0][x1] * fx * (1 - fy) +
					grid[y1][x0] * (1 - fx) * fy +
					grid[y1][x1] * fx * fy
				);
			}),
		);
	}

	const coarse = sampleGrid(4, 4);
	const fine = sampleGrid(10, 10);
	const maxDist = Math.hypot(cx, cy);

	const playableRaw: boolean[][] = Array.from({ length: height }, (_, y) =>
		Array.from({ length: width }, (_, x) => {
			const noise = coarse[y][x] * 0.65 + fine[y][x] * 0.35;
			const dist = Math.hypot(x - cx, y - cy);
			const t = Math.max(0, 1 - dist / maxDist);
			const threshold = 0.25 + (1 - t) * (0.35 + voidTarget * 0.5);
			return noise > threshold;
		}),
	);

	playableRaw[scy][scx] = true;
	const component = floodFillMask(playableRaw, scx, scy, width, height);

	const minSize = width * height * 0.2;
	if (component.size < minSize) {
		return Array.from({ length: height }, (_, y) =>
			Array.from({ length: width }, (_, x) => {
				const dx = x - cx;
				const dy = y - cy;
				return (dx * dx) / (cx * cx * 0.64) + (dy * dy) / (cy * cy * 0.64) <= 1;
			}),
		);
	}

	const mask: boolean[][] = Array.from({ length: height }, () => Array(width).fill(false));
	for (const key of component) {
		const comma = key.indexOf(",");
		mask[+key.slice(comma + 1)][+key.slice(0, comma)] = true;
	}
	return mask;
}

export function floodFillMask(
	mask: boolean[][],
	startX: number,
	startY: number,
	w: number,
	h: number,
): Set<string> {
	const out = new Set<string>();
	const stack: [number, number][] = [[startX, startY]];
	while (stack.length > 0) {
		const [x, y] = stack.pop()!;
		const key = `${x},${y}`;
		if (out.has(key)) continue;
		if (x < 0 || x >= w || y < 0 || y >= h) continue;
		if (!mask[y][x]) continue;
		out.add(key);
		stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
	}
	return out;
}

/** Flood-fill connected floor cells from a start position. */
export function floodFillFloor(
	grid: number[][],
	startX: number,
	startY: number,
	w: number,
	h: number,
	floorValue: number,
): Set<string> {
	const out = new Set<string>();
	const stack: [number, number][] = [[startX, startY]];
	while (stack.length > 0) {
		const [x, y] = stack.pop()!;
		const key = `${x},${y}`;
		if (out.has(key)) continue;
		if (x < 0 || x >= w || y < 0 || y >= h) continue;
		if (grid[y][x] !== floorValue) continue;
		out.add(key);
		stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
	}
	return out;
}

/** Return the cell in `cells` that is closest to (cx, cy). */
export function closestCell(cells: Set<string>, cx: number, cy: number): { x: number; y: number } {
	let bestDist = Infinity;
	let best = { x: Math.floor(cx), y: Math.floor(cy) };
	for (const key of cells) {
		const comma = key.indexOf(",");
		const x = +key.slice(0, comma);
		const y = +key.slice(comma + 1);
		const dist = (x - cx) ** 2 + (y - cy) ** 2;
		if (dist < bestDist) {
			bestDist = dist;
			best = { x, y };
		}
	}
	return best;
}

/** Count floor-value neighbors (8-directional). */
export function countFloorNeighbors(
	grid: number[][],
	x: number,
	y: number,
	w: number,
	h: number,
	floorValue: number,
): number {
	let n = 0;
	for (let dy = -1; dy <= 1; dy++) {
		for (let dx = -1; dx <= 1; dx++) {
			if (dx === 0 && dy === 0) continue;
			const nx = x + dx;
			const ny = y + dy;
			if (nx >= 0 && nx < w && ny >= 0 && ny < h && grid[ny][nx] === floorValue) n++;
		}
	}
	return n;
}
