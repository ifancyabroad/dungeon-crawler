import Phaser from "phaser";

export interface SyncState {
	lastSyncedIdx: number;
	lastSyncedTurn: number;
	lastFloorIndex: number;
	lastDispatchedEventTurn: number;
}

export interface FoggedSprite {
	sprite: Phaser.GameObjects.Sprite;
	idx: number;
}
