/**
 * Geometry utilities for skill area calculations.
 * All functions operate on flat tile indices (row-major, idx = y*width + x).
 */

/**
 * Bresenham's line from casterIdx toward targetIdx.
 *
 * Returns every tile index along the path (excluding the caster's own tile),
 * stopping **before** the first tile whose opacityMask entry is 1 (wall/opaque).
 * The stopping wall tile itself is NOT included.
 *
 * If opacityMask is omitted, no wall stopping is applied.
 */
export function getTilesInLine(
	casterIdx: number,
	targetIdx: number,
	width: number,
	height: number,
	opacityMask?: Uint8Array,
): number[] {
	const cx = casterIdx % width;
	const cy = Math.floor(casterIdx / width);
	const tx = targetIdx % width;
	const ty = Math.floor(targetIdx / width);

	if (cx === tx && cy === ty) return [];

	const dx = Math.abs(tx - cx);
	const dy = Math.abs(ty - cy);
	const sx = cx < tx ? 1 : -1;
	const sy = cy < ty ? 1 : -1;

	let x = cx;
	let y = cy;
	let err = dx - dy;

	const result: number[] = [];

	// We iterate up to dx+dy+1 steps to ensure we always terminate.
	const maxSteps = dx + dy + 1;

	for (let step = 0; step < maxSteps; step++) {
		// Skip the caster's starting tile.
		if (x !== cx || y !== cy) {
			// Out-of-bounds guard (should never happen given valid inputs, but be safe).
			if (x < 0 || y < 0 || x >= width || y >= height) break;

			const idx = y * width + x;

			// Stop before walking through a wall.
			if (opacityMask && opacityMask[idx] === 1) break;

			result.push(idx);
		}

		if (x === tx && y === ty) break;

		const e2 = 2 * err;
		if (e2 > -dy) {
			err -= dy;
			x += sx;
		}
		if (e2 < dx) {
			err += dx;
			y += sy;
		}
	}

	return result;
}

/**
 * All tile indices within a cone emanating from the caster toward a target tile.
 *
 * The cone is centred on the direction vector (caster → target) and spans
 * `angleDegrees` total (e.g. 90° → ±45° either side of the centre axis).
 * Every tile whose centre is within `rangeTiles` Euclidean distance AND within
 * the half-angle of the centre axis is included.
 *
 * The caster's own tile is excluded. No wall stopping is applied.
 *
 * If casterIdx === targetIdx the function returns an empty array.
 */
export function getTilesInCone(
	casterIdx: number,
	targetIdx: number,
	width: number,
	height: number,
	rangeTiles: number,
	angleDegrees: number = 90,
): number[] {
	const cx = casterIdx % width;
	const cy = Math.floor(casterIdx / width);
	const tx = targetIdx % width;
	const ty = Math.floor(targetIdx / width);

	const dirX = tx - cx;
	const dirY = ty - cy;
	if (dirX === 0 && dirY === 0) return [];

	// Precompute the cosine threshold for the half-angle.
	const halfAngleRad = (angleDegrees / 2) * (Math.PI / 180);
	const cosThreshold = Math.cos(halfAngleRad);

	// Normalise the direction vector.
	const dirLen = Math.sqrt(dirX * dirX + dirY * dirY);
	const ndx = dirX / dirLen;
	const ndy = dirY / dirLen;

	const result: number[] = [];
	const r2 = rangeTiles * rangeTiles;

	// Scan the bounding box around the caster up to rangeTiles in each direction.
	const minX = Math.max(0, cx - rangeTiles);
	const maxX = Math.min(width - 1, cx + rangeTiles);
	const minY = Math.max(0, cy - rangeTiles);
	const maxY = Math.min(height - 1, cy + rangeTiles);

	for (let y = minY; y <= maxY; y++) {
		for (let x = minX; x <= maxX; x++) {
			if (x === cx && y === cy) continue;

			const dx = x - cx;
			const dy = y - cy;
			const dist2 = dx * dx + dy * dy;
			if (dist2 > r2) continue;

			const tileLen = Math.sqrt(dist2);
			const cosAngle = (dx * ndx + dy * ndy) / tileLen;
			if (cosAngle < cosThreshold) continue;

			result.push(y * width + x);
		}
	}

	return result;
}
