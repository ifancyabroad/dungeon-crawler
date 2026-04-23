import { Schema, model, Document } from "mongoose";
import type { GameSnapshotDoc as IGameSnapshotDoc } from "@app/shared";

export interface GameSnapshotDoc extends Document, IGameSnapshotDoc {}

export type GameSnapshotCreate = Omit<IGameSnapshotDoc, "createdAt"> & { createdAt?: Date };

const GameSnapshotSchema = new Schema<GameSnapshotDoc>(
	{
		gameId: { type: String, required: true },
		turn: { type: Number, required: true },
		state: { type: Schema.Types.Mixed, required: true },
		createdAt: { type: Date, required: true, default: Date.now },
	},
	{ timestamps: false, minimize: false },
);

GameSnapshotSchema.index({ gameId: 1, turn: 1 });

export const GameSnapshot = model<GameSnapshotDoc>("GameSnapshot", GameSnapshotSchema);
