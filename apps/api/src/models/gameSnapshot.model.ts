import { Schema, model, Document } from "mongoose";
import type { GameSnapshotDoc as IGameSnapshotDoc } from "@app/shared";
import { SnapshotStateSchema } from "./snapshotState.schema";

export interface GameSnapshotDoc extends Document, IGameSnapshotDoc {}

export type GameSnapshotCreate = Omit<IGameSnapshotDoc, "createdAt"> & { createdAt?: Date };

// state uses a nested schema (not Mixed) so Mongoose preserves the full structure on round-trip.
const GameSnapshotSchema = new Schema<GameSnapshotDoc>(
	{
		gameId: { type: String, required: true },
		turn: { type: Number, required: true },
		state: { type: SnapshotStateSchema, required: true },
		createdAt: { type: Date, required: true, default: Date.now },
	},
	{ timestamps: false },
);

GameSnapshotSchema.index({ gameId: 1, turn: 1 });

export const GameSnapshot = model<GameSnapshotDoc>("GameSnapshot", GameSnapshotSchema);
