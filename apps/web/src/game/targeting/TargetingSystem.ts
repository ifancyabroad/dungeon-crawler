/**
 * TargetingSystem — encapsulates all targeting-mode UI for MainScene.
 *
 * Responsibilities:
 *   - Pointer-down: confirm target and dispatch the use_skill action.
 *   - Pointer-move: track hovered tile, compute AoE preview, re-render overlay.
 *   - Store subscription: re-render when targeting store changes.
 *   - Overlay rendering: DCSS-style corner brackets on valid/AoE tiles.
 *
 * Lifecycle (called by MainScene):
 *   1. new TargetingSystem(scene, mapWidth, mapHeight) — created once in create().
 *   2. attach()                                         — registers input handlers once.
 *   3. updateDimensions(w, h)                           — called in buildMapAndHero() on each floor.
 *   4. destroy()                                        — called when the scene shuts down.
 */

import Phaser from "phaser";
import { idxToXY } from "@app/shared";
import { useTargetingStore } from "../../features/targeting/targetingStore";
import type { TargetingStore } from "../../features/targeting/targetingStore";
import { useGameStore } from "../../features/game/gameStore";
import { TILE_WIDTH, TILE_HEIGHT } from "../tiles/tilesetRegistry";

export class TargetingSystem {
	private graphics: Phaser.GameObjects.Graphics | null = null;
	private hoveredIdx: number | null = null;
	private unsub: (() => void) | null = null;
	private disposed = false;
	private scene: Phaser.Scene;
	public mapWidth: number;
	public mapHeight: number;

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
			if (!targeting.validTileIndices.includes(tileIdx)) return;
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

			if (!clickedActorId) return;
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
			const radiusTiles: number =
				(targeting.skillDef.effects[0] as { type: string; radiusTiles?: number })
					?.radiusTiles ?? 1;
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
			targeting.setAoePreview(aoe);
		}

		this.render(useTargetingStore.getState());
	}

	// -------------------------------------------------------------------------
	// Overlay rendering
	// -------------------------------------------------------------------------

	/**
	 * Render DCSS-style corner brackets on each valid/AoE tile.
	 * Rather than filling entire tiles (obscuring the map), we draw 4 small L-shaped
	 * brackets at each tile's corners. The hovered tile gets an additional faint fill.
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

		const CORNER_LEN = 5;
		const CORNER_THICK = 2;

		const drawCorners = (tileX: number, tileY: number, color: number, alpha: number): void => {
			const x = tileX * TILE_WIDTH;
			const y = tileY * TILE_HEIGHT;
			const w = TILE_WIDTH;
			const h = TILE_HEIGHT;
			g.fillStyle(color, alpha);
			g.fillRect(x, y, CORNER_LEN, CORNER_THICK);
			g.fillRect(x, y, CORNER_THICK, CORNER_LEN);
			g.fillRect(x + w - CORNER_LEN, y, CORNER_LEN, CORNER_THICK);
			g.fillRect(x + w - CORNER_THICK, y, CORNER_THICK, CORNER_LEN);
			g.fillRect(x, y + h - CORNER_THICK, CORNER_LEN, CORNER_THICK);
			g.fillRect(x, y + h - CORNER_LEN, CORNER_THICK, CORNER_LEN);
			g.fillRect(x + w - CORNER_LEN, y + h - CORNER_THICK, CORNER_LEN, CORNER_THICK);
			g.fillRect(x + w - CORNER_THICK, y + h - CORNER_LEN, CORNER_THICK, CORNER_LEN);
		};

		const drawFill = (tileX: number, tileY: number, color: number, alpha: number): void => {
			g.fillStyle(color, alpha);
			g.fillRect(tileX * TILE_WIDTH, tileY * TILE_HEIGHT, TILE_WIDTH, TILE_HEIGHT);
		};

		if (ts.skillDef?.targetType === "tile") {
			const VALID_COLOR = 0x4499ff;
			const AOE_COLOR = 0xff8800;
			const hoveredInRange =
				this.hoveredIdx !== null && ts.validTileIndices.includes(this.hoveredIdx);

			for (const idx of ts.validTileIndices) {
				const tx = idx % this.mapWidth;
				const ty = Math.floor(idx / this.mapWidth);
				const isHovered = idx === this.hoveredIdx;
				drawCorners(tx, ty, VALID_COLOR, isHovered ? 0.95 : 0.55);
			}

			if (hoveredInRange && this.hoveredIdx !== null) {
				const tx = this.hoveredIdx % this.mapWidth;
				const ty = Math.floor(this.hoveredIdx / this.mapWidth);
				drawFill(tx, ty, VALID_COLOR, 0.15);
			}

			if (ts.aoePreviewIndices.length > 0) {
				for (const idx of ts.aoePreviewIndices) {
					const tx = idx % this.mapWidth;
					const ty = Math.floor(idx / this.mapWidth);
					drawFill(tx, ty, AOE_COLOR, 0.12);
					drawCorners(tx, ty, AOE_COLOR, 0.75);
				}
				if (hoveredInRange && this.hoveredIdx !== null) {
					const tx = this.hoveredIdx % this.mapWidth;
					const ty = Math.floor(this.hoveredIdx / this.mapWidth);
					drawFill(tx, ty, AOE_COLOR, 0.25);
					drawCorners(tx, ty, AOE_COLOR, 1.0);
				}
			}
			return;
		}

		if (ts.skillDef?.targetType === "actor") {
			const ACTOR_COLOR = 0x44ff88;
			const state = useGameStore.getState().state;
			const floor = state?.floors[state.heroFloorIndex];
			if (!floor) return;

			for (const id of ts.validActorIds) {
				const actor = floor.state.actorsById[id];
				if (!actor || !actor.alive) continue;
				const tx = actor.idx % this.mapWidth;
				const ty = Math.floor(actor.idx / this.mapWidth);
				const isHovered = actor.idx === this.hoveredIdx;
				if (isHovered) {
					drawFill(tx, ty, ACTOR_COLOR, 0.2);
					drawCorners(tx, ty, ACTOR_COLOR, 1.0);
				} else {
					drawCorners(tx, ty, ACTOR_COLOR, 0.6);
				}
			}
		}
	}
}
