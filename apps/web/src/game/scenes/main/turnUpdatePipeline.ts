import Phaser from "phaser";
import { idxToXY, type FloorState, type GameEvent } from "@app/shared";
import type { GameStore } from "../../../features/game/gameStore";
import { TILE_HEIGHT, TILE_WIDTH } from "../../tiles/tilesetRegistry";
import { MOVE_DURATION_MS } from "../../fx/MoveTweenManager";
import type { SyncState } from "./types";

export interface TurnUpdateDeps {
	mapWidth: number;
	player: Phaser.GameObjects.Sprite | null;
	getPlayerTilePos: () => { x: number; y: number };
	setPlayerTilePos: (x: number, y: number) => void;
	triggerFloorTransition: (gs: NonNullable<GameStore["state"]>) => void;
	syncHeroToStore: (idx: number) => void;
	applyFogOfWar: (explored: number[], heroX: number, heroY: number) => void;
	dispatchFxAndSync: (
		events: GameEvent[],
		gs: NonNullable<GameStore["state"]>,
		floor: FloorState | null,
	) => void;
	skillAnimController: {
		handle: (
			skillEvent: Extract<NonNullable<GameStore["events"]>[number], { type: "skill_used" }>,
			player: Phaser.GameObjects.Sprite,
			heroIdx: number,
			heroMoved: boolean,
			onImpact: () => void,
		) => { handled: boolean; fxDeferred: boolean; newHeroTilePos?: { x: number; y: number } };
	} | null;
}

export function onStoreUpdate(storeState: GameStore, sync: SyncState, deps: TurnUpdateDeps): void {
	const gs = storeState.state;

	// Floor change: slide hero onto exit tile and fade out simultaneously, then rebuild → fade-in.
	if (gs && gs.heroFloorIndex !== sync.lastFloorIndex) {
		const fromFloor = sync.lastFloorIndex;
		sync.lastFloorIndex = gs.heroFloorIndex;
		const exitIdx = gs.floors[fromFloor]?.state.exitIdx;
		if (exitIdx != null && deps.player) {
			const { x: ex, y: ey } = idxToXY(exitIdx, deps.mapWidth);
			deps.player.scene.tweens.add({
				targets: deps.player,
				x: ex * TILE_WIDTH + TILE_WIDTH / 2,
				y: ey * TILE_HEIGHT + TILE_HEIGHT / 2,
				duration: MOVE_DURATION_MS,
				ease: Phaser.Math.Easing.Sine.Out,
			});
		}
		deps.triggerFloorTransition(gs);
		return;
	}

	const turnChanged = gs != null && gs.turn !== sync.lastSyncedTurn;
	if (gs && turnChanged) {
		sync.lastSyncedTurn = gs.turn;
		const floor = gs.floors[gs.heroFloorIndex];
		const explored = floor?.state.explored ?? [];

		// Events are only fresh when event turn matches this turn.
		const eventTurn = storeState.lastOptimisticEventTurn;
		const freshEvents =
			storeState.events.length > 0 &&
			eventTurn === gs.turn &&
			eventTurn !== sync.lastDispatchedEventTurn;
		const events = freshEvents ? storeState.events : [];
		if (freshEvents) sync.lastDispatchedEventTurn = eventTurn;

		const heroMoved = storeState.hero.idx !== sync.lastSyncedIdx;
		const skillUsedEvent = events.find(
			(e): e is Extract<typeof e, { type: "skill_used" }> =>
				e.type === "skill_used" && e.actorId === gs.heroId,
		);

		let fxDeferred = false;
		if (skillUsedEvent && deps.skillAnimController && deps.player) {
			const onImpact = () => deps.dispatchFxAndSync(events, gs, floor?.state ?? null);
			const animResult = deps.skillAnimController.handle(
				skillUsedEvent,
				deps.player,
				storeState.hero.idx,
				heroMoved,
				onImpact,
			);

			if (animResult.handled) {
				sync.lastSyncedIdx = storeState.hero.idx;
				fxDeferred = animResult.fxDeferred;
				if (animResult.newHeroTilePos) {
					deps.setPlayerTilePos(animResult.newHeroTilePos.x, animResult.newHeroTilePos.y);
				}
			} else if (heroMoved) {
				sync.lastSyncedIdx = storeState.hero.idx;
				deps.syncHeroToStore(storeState.hero.idx);
			}
		} else if (heroMoved) {
			sync.lastSyncedIdx = storeState.hero.idx;
			deps.syncHeroToStore(storeState.hero.idx);
		}

		const heroPos = deps.getPlayerTilePos();
		deps.applyFogOfWar(explored, heroPos.x, heroPos.y);

		if (!fxDeferred) {
			deps.dispatchFxAndSync(events, gs, floor?.state ?? null);
		}
	} else if (storeState.hero.idx !== sync.lastSyncedIdx) {
		// Turn unchanged but hero idx drifted (e.g. server correction).
		sync.lastSyncedIdx = storeState.hero.idx;
		deps.syncHeroToStore(storeState.hero.idx);
	}
}
