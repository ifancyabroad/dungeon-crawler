import { Schema, model, Document } from "mongoose";
import type { GameSessionDoc as IGameSessionDoc } from "@app/shared";

export interface GameSessionDoc extends Document, IGameSessionDoc {}

const GameSessionSchema = new Schema<GameSessionDoc>(
	{
		gameId: { type: String, required: true, unique: true },
		tokenHash: { type: String, required: true },
		lastSeenAt: { type: Date, required: true },
		userId: { type: Schema.Types.ObjectId, default: null },
		seed: { type: Number, required: true },
		mapGenVersion: { type: Number, required: true },
		floorConfigs: { type: Schema.Types.Mixed, required: true },
		latestSnapshotTurn: { type: Number, required: true },
	},
	{ timestamps: true },
);

GameSessionSchema.index({ tokenHash: 1 });

export const GameSession = model<GameSessionDoc>("GameSession", GameSessionSchema);
