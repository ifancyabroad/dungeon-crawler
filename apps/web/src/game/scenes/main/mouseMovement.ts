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
		this.tileMarker?.setTile(tileX, tileY, isWalkable ? "valid" : "invalid");
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
		const destinationIdx = this.destinationIdx;
		if (destinationIdx === null) return;

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

		// Check whether any live hostile is currently visible.
		let hostileVisible = false;
		for (const actor of Object.values(floor.state.actorsById)) {
			if (actor.id === state.heroId || !actor.alive) continue;
			if (actor.faction === "hostile" && visible[actor.idx] === 1) {
				hostileVisible = true;
				break;
			}
		}

		// Auto-travel guard: abort if a hostile is visible.
		// Explicit clicks (singleStep) bypass this so the player can still step one tile.
		if (hostileVisible && !singleStep) {
			this.destinationIdx = null;
			return;
		}

		// Arrived.
		if (hero.idx === destinationIdx) {
			this.destinationIdx = null;
			return;
		}

		// Build exploration-constrained walkable mask: only traverse explored/visible tiles.
		const explored = floor.state.explored;
		const exploredWalkable = new Uint8Array(walkableMask.length);
		for (let i = 0; i < exploredWalkable.length; i++) {
			exploredWalkable[i] =
				walkableMask[i] === 1 && (explored[i] === 1 || visible[i] === 1) ? 1 : 0;
		}

		const nextIdx = bfsNextStep(
			hero.idx,
			destinationIdx,
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
		const stepDx = nextPos.x - heroPos.x;
		const stepDy = nextPos.y - heroPos.y;
		const dir = DELTA_TO_DIR[`${stepDx},${stepDy}`];
		if (!dir) {
			this.destinationIdx = null;
			return;
		}

		// If next tile has a hostile, attack and stop.
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

		// If a hostile is visible, don't auto-continue after this step.
		if (hostileVisible) this.destinationIdx = null;

		useGameStore.getState().sendAction({ type: "move", direction: dir });
	}
}
