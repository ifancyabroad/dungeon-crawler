/**
 * TargetingSystem — encapsulates all targeting-mode UI for MainScene.
 *
 * Responsibilities:
 *   - Pointer-down: confirm target and dispatch the use_skill action, or cancel on miss.
 *   - Pointer-move: track hovered tile, compute AoE preview, re-render overlay.
 *   - Store subscription: re-render when targeting store changes.
 *   - Overlay rendering:
 *       • Dims every tile outside the skill's potential area (potentialTileIndices).
 *       • Shows valid-hover (orange) or invalid-hover (grey) fills on the hovered tile.
 *       • Shows AOE preview fills in orange when hovering a valid tile target.
 *
 * Lifecycle (called by MainScene):
 *   1. new TargetingSystem(scene, mapWidth, mapHeight) — created once in create().
 *   2. attach()                                         — registers input handlers once.
 *   3. updateDimensions(w, h)                           — called in buildMapAndHero() on each floor.
 *   4. destroy()                                        — called when the scene shuts down.
 */

import Phaser from "phaser";
import { idxToXY, getTilesInLine, getTilesInCone } from "@app/shared";
import { useTargetingStore } from "../../features/targeting/targetingStore";
import type { TargetingStore } from "../../features/targeting/targetingStore";
import { useGameStore } from "../../features/game/gameStore";
import { TILE_WIDTH, TILE_HEIGHT } from "../tiles/tilesetRegistry";

// Colours used in the overlay.
const DIM_COLOR = 0x000000;
const ORANGE = 0xff8800; // valid hover + AOE preview
const INORANGE = 0x888888;

export class TargetingSystem {
	private graphics: Phaser.GameObjects.Graphics | null = null;
	private hoveredIdx: number | null = null;
	private unsub: (() => void) | null = null;
	private disposed = false;
	private scene: Phaser.Scene;
	public mapWidth: number;
	public mapHeight: number;
	/** Opacity mask for the current floor — used by line_damage to stop at walls. */
	private opacityMask: Uint8Array | null = null;

	constructor(scene: Phaser.Scene, mapWidth: number, mapHeight: number) {
		this.scene = scene;
		this.mapWidth = mapWidth;
		this.mapHeight = mapHeight;
	}

	/** Register pointer and store listeners — call once from MainScene.create(). */
	attach(): void {
		this.scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
		this.scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);

		this.unsub = useTargetingStore.subscribe((ts) => {
			if (this.disposed) return;
			if (!ts.active) this.hoveredIdx = null;
			this.render(ts);
		});
	}

	/**
	 * Update map dimensions when a new floor is loaded.
	 * Destroys the current graphics object so it is recreated at the correct layer depth.
	 */
	updateDimensions(mapWidth: number, mapHeight: number): void {
		this.mapWidth = mapWidth;
		this.mapHeight = mapHeight;
		this.graphics?.destroy();
		this.graphics = null;
		this.hoveredIdx = null;
		this.opacityMask = null;
	}

	/** Provide the precomputed opacity mask for the current floor. */
	setOpacityMask(mask: Uint8Array): void {
		this.opacityMask = mask;
	}

	/** Full cleanup — call from MainScene shutdown/destroy. */
	destroy(): void {
		this.disposed = true;
		this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
		this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
		this.unsub?.();
		this.unsub = null;
		this.graphics?.destroy();
		this.graphics = null;
	}

	// -------------------------------------------------------------------------
	// Input handlers
	// -------------------------------------------------------------------------

	private onPointerDown(pointer: Phaser.Input.Pointer): void {
		const targeting = useTargetingStore.getState();
		if (!targeting.active || !targeting.skillDef) return;

		const worldX = pointer.worldX;
		const worldY = pointer.worldY;
		const tileX = Math.floor(worldX / TILE_WIDTH);
		const tileY = Math.floor(worldY / TILE_HEIGHT);
		const tileIdx = tileY * this.mapWidth + tileX;

		if (targeting.skillDef.targetType === "tile") {
			if (!targeting.validTileIndices.includes(tileIdx)) {
				// Clicking outside a valid tile cancels targeting.
				targeting.exitTargeting();
				return;
			}
			const action = {
				type: "use_skill" as const,
				skillId: targeting.skillDef.id,
				targetTileIdx: tileIdx,
			};
			targeting.exitTargeting();
			useGameStore.getState().sendAction(action);
			return;
		}

		if (targeting.skillDef.targetType === "actor") {
			const state = useGameStore.getState().state;
			if (!state) return;
			const floor = state.floors[state.heroFloorIndex];
			if (!floor) return;

			let clickedActorId: string | null = null;
			for (const id of targeting.validActorIds) {
				const actor = floor.state.actorsById[id];
				if (!actor || !actor.alive) continue;
				const { x: ax, y: ay } = idxToXY(actor.idx, this.mapWidth);
				const actorPixelX = ax * TILE_WIDTH + TILE_WIDTH / 2;
				const actorPixelY = ay * TILE_HEIGHT + TILE_HEIGHT / 2;
				if (
					Math.abs(worldX - actorPixelX) <= TILE_WIDTH &&
					Math.abs(worldY - actorPixelY) <= TILE_HEIGHT
				) {
					clickedActorId = id;
					break;
				}
			}

			if (!clickedActorId) {
				// Clicking anywhere without a valid actor cancels targeting.
				targeting.exitTargeting();
				return;
			}
			const action = {
				type: "use_skill" as const,
				skillId: targeting.skillDef.id,
				targetActorId: clickedActorId,
			};
			targeting.exitTargeting();
			useGameStore.getState().sendAction(action);
		}
	}

	private onPointerMove(pointer: Phaser.Input.Pointer): void {
		const targeting = useTargetingStore.getState();
		if (!targeting.active || !targeting.skillDef) return;

		const tileX = Math.floor(pointer.worldX / TILE_WIDTH);
		const tileY = Math.floor(pointer.worldY / TILE_HEIGHT);
		this.hoveredIdx = tileY * this.mapWidth + tileX;

		if (targeting.skillDef.targetType === "tile") {
			const hoveredIdx = tileY * this.mapWidth + tileX;
			// Only show an AoE preview when the cursor is over a valid target tile.
			// This prevents the cone/arc being drawn toward out-of-range tiles.
			if (targeting.validTileIndices.includes(hoveredIdx)) {
				const tier =
					targeting.skillDef.effectsByRank[targeting.skillRank - 1] ??
					targeting.skillDef.effectsByRank[0];
				const firstEffect = tier?.[0];
				targeting.setAoePreview(
					firstEffect ? this.computeAoePreview(firstEffect, tileX, tileY) : [],
				);
			} else {
				targeting.setAoePreview([]);
			}
		}

		this.render(useTargetingStore.getState());
	}

	/**
	 * Compute the AoE tile preview for the currently hovered tile based on the
	 * first effect of the skill being targeted. Returns an array of flat tile indices.
	 */
	private computeAoePreview(
		effect: { type: string } & Record<string, unknown>,
		tileX: number,
		tileY: number,
	): number[] {
		const hoveredIdx = tileY * this.mapWidth + tileX;

		if (effect.type === "line_damage") {
			const heroIdx = this.getHeroIdx();
			if (heroIdx === null) return [];
			return getTilesInLine(
				heroIdx,
				hoveredIdx,
				this.mapWidth,
				this.mapHeight,
				this.opacityMask ?? undefined,
			);
		}

		if (effect.type === "cone_damage") {
			const heroIdx = this.getHeroIdx();
			if (heroIdx === null) return [];
			return getTilesInCone(
				heroIdx,
				hoveredIdx,
				this.mapWidth,
				this.mapHeight,
				(effect.rangeTiles as number) ?? 3,
				(effect.angleDegrees as number) ?? 90,
			);
		}

		if (effect.type === "area_damage") {
			const radiusTiles = (effect.radiusTiles as number) ?? 0;
			const aoe: number[] = [];
			for (let dy = -radiusTiles; dy <= radiusTiles; dy++) {
				for (let dx = -radiusTiles; dx <= radiusTiles; dx++) {
					const nx = tileX + dx;
					const ny = tileY + dy;
					if (nx >= 0 && nx < this.mapWidth && ny >= 0 && ny < this.mapHeight) {
						aoe.push(ny * this.mapWidth + nx);
					}
				}
			}
			return aoe;
		}

		// single_target_damage and other tile-targeted effects with no inherent AoE
		// highlight only the hovered tile itself.
		if (tileX >= 0 && tileX < this.mapWidth && tileY >= 0 && tileY < this.mapHeight) {
			return [hoveredIdx];
		}
		return [];
	}

	/** Returns the hero's current flat tile index, or null if state is unavailable. */
	private getHeroIdx(): number | null {
		const { state } = useGameStore.getState();
		if (!state) return null;
		const hero = state.floors[state.heroFloorIndex]?.state.actorsById[state.heroId];
		return hero?.idx ?? null;
	}

	// -------------------------------------------------------------------------
	// Overlay rendering
	// -------------------------------------------------------------------------

	/**
	 * Render the targeting overlay:
	 *   1. Dim all tiles outside the skill's potential range.
	 *   2. Draw AOE preview fills (orange) when hovering a valid tile.
	 *   3. Draw a hover fill (orange = valid, grey = invalid) on the hovered tile.
	 *
	 * Tile fills at depth 20 sit above actor sprites (depth 9–10), so out-of-range
	 * actors are naturally dimmed by the overlay.
	 */
	render(ts: TargetingStore): void {
		if (!ts.active) {
			this.graphics?.clear();
			return;
		}

		if (!this.graphics) {
			this.graphics = this.scene.add.graphics();
			this.graphics.setDepth(20);
		}
		const g = this.graphics;
		g.clear();

		const potentialSet = new Set(ts.potentialTileIndices);
		const heroIdx = this.getHeroIdx();

		// --- Pass 1: dim all out-of-range tiles (excluding the hero's own tile) ---
		g.fillStyle(DIM_COLOR, 0.6);
		for (let idx = 0; idx < this.mapWidth * this.mapHeight; idx++) {
			if (!potentialSet.has(idx) && idx !== heroIdx) {
				const tx = idx % this.mapWidth;
				const ty = Math.floor(idx / this.mapWidth);
				g.fillRect(tx * TILE_WIDTH, ty * TILE_HEIGHT, TILE_WIDTH, TILE_HEIGHT);
			}
		}

		const drawFill = (tileX: number, tileY: number, color: number, alpha: number): void => {
			g.fillStyle(color, alpha);
			g.fillRect(tileX * TILE_WIDTH, tileY * TILE_HEIGHT, TILE_WIDTH, TILE_HEIGHT);
		};

		// --- Pass 2: AOE preview (tile-targeted skills only) ---
		if (ts.skillDef?.targetType === "tile" && ts.aoePreviewIndices.length > 0) {
			const hoveredInRange =
				this.hoveredIdx !== null && ts.validTileIndices.includes(this.hoveredIdx);

			for (const idx of ts.aoePreviewIndices) {
				const tx = idx % this.mapWidth;
				const ty = Math.floor(idx / this.mapWidth);
				const isHovered = hoveredInRange && idx === this.hoveredIdx;
				drawFill(tx, ty, ORANGE, isHovered ? 0.35 : 0.18);
			}
		}

		// --- Pass 3: hover fill ---
		if (this.hoveredIdx === null) return;
		if (!potentialSet.has(this.hoveredIdx)) return;

		const tx = this.hoveredIdx % this.mapWidth;
		const ty = Math.floor(this.hoveredIdx / this.mapWidth);

		if (ts.skillDef?.targetType === "tile") {
			// Skip hover fill when the AOE preview already covers the hovered tile brightly.
			if (
				ts.aoePreviewIndices.length === 0 ||
				!ts.aoePreviewIndices.includes(this.hoveredIdx)
			) {
				const isValid = ts.validTileIndices.includes(this.hoveredIdx);
				drawFill(tx, ty, isValid ? ORANGE : INORANGE, isValid ? 0.3 : 0.15);
			}
			return;
		}

		if (ts.skillDef?.targetType === "actor") {
			const state = useGameStore.getState().state;
			const floor = state?.floors[state.heroFloorIndex];
			const isValidActorTile =
				!!floor &&
				ts.validActorIds.some((id) => {
					const actor = floor.state.actorsById[id];
					return actor?.alive && actor.idx === this.hoveredIdx;
				});
			drawFill(tx, ty, isValidActorTile ? ORANGE : INORANGE, isValidActorTile ? 0.3 : 0.15);
		}
	}
}
