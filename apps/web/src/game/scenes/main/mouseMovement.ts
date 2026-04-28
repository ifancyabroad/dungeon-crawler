/**
 * MouseMovementController — DCSS-style click-to-move.
 *
 * Behaviour:
 *   - Hovering shows a corner-bracket marker via TileMarker.
 *   - Clicking an explored/visible walkable tile starts auto-travel.
 *   - Clicking an explored/visible tile adjacent to the hero that is occupied
 *     by a hostile sends an AttackAction instead.
 *   - Auto-travel continues step-by-step (one server round-trip per step).
 *   - If any hostile actor becomes visible the travel is cancelled immediately.
 *   - While a hostile is visible each click moves only one step (no auto-travel).
 *   - Keyboard input cancels travel via cancelTravel().
 *   - Defers to TargetingSystem when targeting mode is active.
 */

import Phaser from "phaser";
import {
	bfsNextStep,
	computeVisibility,
	getActorAtIdx,
	idxToXY,
	isInteractableTile,
	shouldBumpTile,
	xyToIdx,
	VISION_RADIUS,
	type Direction,
} from "@app/shared";
import { useGameStore } from "../../../features/game/gameStore";
import { useTargetingStore } from "../../../features/targeting/targetingStore";
import { TILE_WIDTH, TILE_HEIGHT } from "../../tiles/tilesetRegistry";
import type { TileMarker } from "./tileMarker";

/** Map dx/dy → Direction string. */
const DELTA_TO_DIR: Record<string, Direction> = {
	"0,-1": "up",
	"0,1": "down",
	"-1,0": "left",
	"1,0": "right",
	"-1,-1": "up-left",
	"1,-1": "up-right",
	"-1,1": "down-left",
	"1,1": "down-right",
};

export class MouseMovementController {
	private scene: Phaser.Scene;
	private tileMarker: TileMarker | null = null;
	private mapWidth: number;
	private mapHeight: number;

	private destinationIdx: number | null = null;
	/** Guard: prevents re-entrant tryAdvance calls from the store subscription. */
	private advancing = false;

	private _instantTravel = false;
	private _lastTravelPath: { x: number; y: number }[] = [];

	private unsubStore: (() => void) | null = null;
	private disposed = false;

	constructor(scene: Phaser.Scene, mapWidth: number, mapHeight: number) {
		this.scene = scene;
		this.mapWidth = mapWidth;
		this.mapHeight = mapHeight;
	}

	attach(tileMarker: TileMarker): void {
		this.tileMarker = tileMarker;
		this.scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
		this.scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);

		let prevActionInProgress = useGameStore.getState().actionInProgress;
		this.unsubStore = useGameStore.subscribe((s) => {
			if (this.disposed || this.destinationIdx === null || !s.state) return;
			// Trigger when an action finishes (animation done) so we can send the next step.
			const justFinished = prevActionInProgress && !s.actionInProgress;
			prevActionInProgress = s.actionInProgress;
			if (justFinished) {
				this.tryAdvance();
			}
		});
	}

	updateDimensions(mapWidth: number, mapHeight: number): void {
		this.mapWidth = mapWidth;
		this.mapHeight = mapHeight;
		this.destinationIdx = null;
		this.tileMarker?.clear();
	}

	cancelTravel(): void {
		this.destinationIdx = null;
	}

	isInstantTravel(): boolean {
		return this._instantTravel;
	}

	/** Returns the tile positions visited during the last instant travel, then clears the list. */
	consumeTravelPath(): { x: number; y: number }[] {
		const path = this._lastTravelPath;
		this._lastTravelPath = [];
		return path;
	}

	destroy(): void {
		this.disposed = true;
		this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
		this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
		this.unsubStore?.();
		this.unsubStore = null;
	}

	// ---------------------------------------------------------------------------
	// Pointer handlers
	// ---------------------------------------------------------------------------

	private onPointerMove(pointer: Phaser.Input.Pointer): void {
		if (this.disposed) return;
		if (useTargetingStore.getState().active) {
			this.tileMarker?.clear();
			return;
		}

		const { state, walkableByFloor, opacityByFloor } = useGameStore.getState();
		if (!state) {
			this.tileMarker?.clear();
			return;
		}

		const tileX = Math.floor(pointer.worldX / TILE_WIDTH);
		const tileY = Math.floor(pointer.worldY / TILE_HEIGHT);
		if (tileX < 0 || tileX >= this.mapWidth || tileY < 0 || tileY >= this.mapHeight) {
			this.tileMarker?.clear();
			return;
		}

		const floor = state.floors[state.heroFloorIndex];
		if (!floor) {
			this.tileMarker?.clear();
			return;
		}

		const tileIdx = xyToIdx(tileX, tileY, this.mapWidth);
		const explored = floor.state.explored;
		const walkableMask = walkableByFloor?.[state.heroFloorIndex];
		const opacityMask = opacityByFloor?.[state.heroFloorIndex];

		const hero = floor.state.actorsById[state.heroId];
		const heroPos = hero ? idxToXY(hero.idx, this.mapWidth) : null;
		const visible =
			heroPos && opacityMask
				? computeVisibility(
						heroPos.x,
						heroPos.y,
						this.mapWidth,
						this.mapHeight,
						opacityMask,
						VISION_RADIUS,
					)
				: null;

		const isKnown = explored[tileIdx] === 1 || (visible !== null && visible[tileIdx] === 1);
		if (!isKnown) {
			this.tileMarker?.clear();
			return;
		}

		const isWalkable = walkableMask ? walkableMask[tileIdx] === 1 : false;
		const isInteractable = isInteractableTile(floor.state, tileIdx);
		this.tileMarker?.setTile(tileX, tileY, isWalkable || isInteractable ? "valid" : "invalid");
	}

	private onPointerDown(pointer: Phaser.Input.Pointer): void {
		if (this.disposed) return;
		if (useTargetingStore.getState().active) return;

		const { state, walkableByFloor, opacityByFloor } = useGameStore.getState();
		if (!state) return;
		if (state.pendingInteraction !== null) return;

		const floor = state.floors[state.heroFloorIndex];
		if (!floor) return;

		const hero = floor.state.actorsById[state.heroId];
		if (!hero) return;

		const tileX = Math.floor(pointer.worldX / TILE_WIDTH);
		const tileY = Math.floor(pointer.worldY / TILE_HEIGHT);
		if (tileX < 0 || tileX >= this.mapWidth || tileY < 0 || tileY >= this.mapHeight) return;

		const tileIdx = xyToIdx(tileX, tileY, this.mapWidth);
		const explored = floor.state.explored;

		const opacityMask = opacityByFloor?.[state.heroFloorIndex];
		const heroPos = idxToXY(hero.idx, this.mapWidth);
		const visible = opacityMask
			? computeVisibility(
					heroPos.x,
					heroPos.y,
					this.mapWidth,
					this.mapHeight,
					opacityMask,
					VISION_RADIUS,
				)
			: null;

		const isKnown = explored[tileIdx] === 1 || (visible !== null && visible[tileIdx] === 1);
		if (!isKnown) return;

		// Clicking the hero's own tile → wait / pass turn.
		const dx = tileX - heroPos.x;
		const dy = tileY - heroPos.y;
		if (dx === 0 && dy === 0) {
			useGameStore.getState().sendAction({ type: "wait" });
			return;
		}

		// Check if clicked tile is adjacent and has a hostile → attack.
		if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && (dx !== 0 || dy !== 0)) {
			const occupant = getActorAtIdx(floor.state, tileIdx);
			if (
				occupant &&
				occupant.id !== state.heroId &&
				occupant.faction === "hostile" &&
				occupant.alive
			) {
				const dir = DELTA_TO_DIR[`${dx},${dy}`];
				if (dir) {
					useGameStore.getState().sendAction({ type: "attack", direction: dir });
					return;
				}
			}
		}

		// Interactable (non-walkable) tile: allow clicking to path toward and bump.
		if (isInteractableTile(floor.state, tileIdx)) {
			this.destinationIdx = tileIdx;
			this.tryAdvance(true);
			return;
		}

		const walkableMask = walkableByFloor?.[state.heroFloorIndex];
		if (!walkableMask || walkableMask[tileIdx] !== 1) return;

		// Set destination and take first step (single-step: bypass hostile-visible abort).
		this.destinationIdx = tileIdx;
		this.tryAdvance(true);
	}

	// ---------------------------------------------------------------------------
	// Auto-travel
	// ---------------------------------------------------------------------------

	/**
	 * Attempt to send the next step toward destinationIdx.
	 * singleStep=true: skip the hostile-visible abort and clear destination after one move.
	 *   Used for explicit clicks so the player can still move one tile when enemies are visible.
	 * singleStep=false (default): abort if any hostile is visible (auto-travel guard).
	 */
	private tryAdvance(singleStep = false): void {
		if (this.advancing || this.disposed) return;
		if (this.destinationIdx === null) return;
		this.advancing = true;
		try {
			this.doAdvance(singleStep);
		} finally {
			this.advancing = false;
		}
	}

	private doAdvance(singleStep: boolean): void {
		if (this.destinationIdx === null) return;

		const { state, actionInProgress, walkableByFloor, opacityByFloor } =
			useGameStore.getState();
		if (!state || actionInProgress) return;

		const floor = state.floors[state.heroFloorIndex];
		if (!floor) {
			this.destinationIdx = null;
			return;
		}

		const hero = floor.state.actorsById[state.heroId];
		if (!hero) {
			this.destinationIdx = null;
			return;
		}

		const opacityMask = opacityByFloor?.[state.heroFloorIndex];
		const walkableMask = walkableByFloor?.[state.heroFloorIndex];
		if (!opacityMask || !walkableMask) return;

		const heroPos = idxToXY(hero.idx, this.mapWidth);
		const visible = computeVisibility(
			heroPos.x,
			heroPos.y,
			this.mapWidth,
			this.mapHeight,
			opacityMask,
			VISION_RADIUS,
		);

		let hostileVisible = false;
		for (const actor of Object.values(floor.state.actorsById)) {
			if (actor.id === state.heroId || !actor.alive) continue;
			if (actor.faction === "hostile" && visible[actor.idx] === 1) {
				hostileVisible = true;
				break;
			}
		}

		// Branch A — no hostiles visible: run all steps synchronously in one frame.
		if (!hostileVisible) {
			this._instantTravel = true;
			this._lastTravelPath = [];
			useGameStore.getState().setActionInProgress(true);

			while (this.destinationIdx !== null) {
				const {
					state: s,
					walkableByFloor: wbf,
					opacityByFloor: obf,
				} = useGameStore.getState();
				if (!s) break;

				const f = s.floors[s.heroFloorIndex];
				const h = f?.state.actorsById[s.heroId];
				const om = obf?.[s.heroFloorIndex];
				if (!f || !h || !om) break;

				const hPos = idxToXY(h.idx, this.mapWidth);
				const vis = computeVisibility(
					hPos.x,
					hPos.y,
					this.mapWidth,
					this.mapHeight,
					om,
					VISION_RADIUS,
				);

				let hostile = false;
				for (const actor of Object.values(f.state.actorsById)) {
					if (actor.id === s.heroId || !actor.alive) continue;
					if (actor.faction === "hostile" && vis[actor.idx] === 1) {
						hostile = true;
						break;
					}
				}
				if (hostile) {
					this.destinationIdx = null;
					break;
				}

				if (h.idx === this.destinationIdx) {
					this.destinationIdx = null;
					break;
				}

				const wm = wbf?.[s.heroFloorIndex];
				if (!wm) break;
				const exploredWalkable = buildExploredWalkableMask(wm, f.state.explored, vis);

				if (isInteractableTile(f.state, this.destinationIdx)) {
					exploredWalkable[this.destinationIdx] = 1;
				}

				const nextIdx = bfsNextStep(
					h.idx,
					this.destinationIdx,
					exploredWalkable,
					f.state,
					this.mapWidth,
					this.mapHeight,
				);
				if (nextIdx === undefined) {
					this.destinationIdx = null;
					break;
				}

				// Adjacent interactable bump: clear destination, send bump if applicable, stop.
				if (
					nextIdx === this.destinationIdx &&
					isInteractableTile(f.state, this.destinationIdx)
				) {
					const { x: dx, y: dy } = idxToXY(this.destinationIdx, this.mapWidth);
					const bumpDir = DELTA_TO_DIR[`${dx - hPos.x},${dy - hPos.y}`];
					this.destinationIdx = null;
					if (bumpDir && shouldBumpTile(f.state, nextIdx)) {
						useGameStore
							.getState()
							.sendAction({ type: "move", direction: bumpDir }, true);
					}
					break;
				}

				const nextPos = idxToXY(nextIdx, this.mapWidth);
				const dir = DELTA_TO_DIR[`${nextPos.x - hPos.x},${nextPos.y - hPos.y}`];
				if (!dir) {
					this.destinationIdx = null;
					break;
				}

				const occupant = getActorAtIdx(f.state, nextIdx);
				if (
					occupant &&
					occupant.id !== s.heroId &&
					occupant.faction === "hostile" &&
					occupant.alive
				) {
					this.destinationIdx = null;
					useGameStore.getState().sendAction({ type: "attack", direction: dir }, true);
					break;
				}

				const invalidAtBefore = useGameStore.getState().lastInvalidMoveAt;
				useGameStore.getState().sendAction({ type: "move", direction: dir }, true);
				if (useGameStore.getState().lastInvalidMoveAt !== invalidAtBefore) break;
				this._lastTravelPath.push(hPos);
			}

			this._instantTravel = false;
			useGameStore.getState().setActionInProgress(false);
			return;
		}

		// Branch B — hostile visible: explicit single click bypass; one step, then stop.
		if (!singleStep) {
			this.destinationIdx = null;
			return;
		}

		if (hero.idx === this.destinationIdx) {
			this.destinationIdx = null;
			return;
		}

		const exploredWalkable = buildExploredWalkableMask(
			walkableMask,
			floor.state.explored,
			visible,
		);

		if (isInteractableTile(floor.state, this.destinationIdx)) {
			exploredWalkable[this.destinationIdx] = 1;
			const nextIdxToward = bfsNextStep(
				hero.idx,
				this.destinationIdx,
				exploredWalkable,
				floor.state,
				this.mapWidth,
				this.mapHeight,
			);
			if (nextIdxToward === undefined) {
				this.destinationIdx = null;
				return;
			}
			if (nextIdxToward === this.destinationIdx) {
				const { x: destX, y: destY } = idxToXY(this.destinationIdx, this.mapWidth);
				const bumpDir = DELTA_TO_DIR[`${destX - heroPos.x},${destY - heroPos.y}`];
				this.destinationIdx = null;
				if (bumpDir && shouldBumpTile(floor.state, nextIdxToward)) {
					useGameStore.getState().sendAction({ type: "move", direction: bumpDir });
				}
				return;
			}
			const { x: tx, y: ty } = idxToXY(nextIdxToward, this.mapWidth);
			const approachDir = DELTA_TO_DIR[`${tx - heroPos.x},${ty - heroPos.y}`];
			if (!approachDir) {
				this.destinationIdx = null;
				return;
			}
			this.destinationIdx = null;
			useGameStore.getState().sendAction({ type: "move", direction: approachDir });
			return;
		}

		const nextIdx = bfsNextStep(
			hero.idx,
			this.destinationIdx,
			exploredWalkable,
			floor.state,
			this.mapWidth,
			this.mapHeight,
		);
		if (nextIdx === undefined) {
			this.destinationIdx = null;
			return;
		}

		const nextPos = idxToXY(nextIdx, this.mapWidth);
		const dir = DELTA_TO_DIR[`${nextPos.x - heroPos.x},${nextPos.y - heroPos.y}`];
		if (!dir) {
			this.destinationIdx = null;
			return;
		}

		const occupant = getActorAtIdx(floor.state, nextIdx);
		if (
			occupant &&
			occupant.id !== state.heroId &&
			occupant.faction === "hostile" &&
			occupant.alive
		) {
			this.destinationIdx = null;
			useGameStore.getState().sendAction({ type: "attack", direction: dir });
			return;
		}

		this.destinationIdx = null;
		useGameStore.getState().sendAction({ type: "move", direction: dir });
	}
}

function buildExploredWalkableMask(
	walkableMask: Uint8Array,
	explored: number[],
	visible: Uint8Array,
): Uint8Array {
	const result = new Uint8Array(walkableMask.length);
	for (let i = 0; i < result.length; i++) {
		result[i] = walkableMask[i] === 1 && (explored[i] === 1 || visible[i] === 1) ? 1 : 0;
	}
	return result;
}
