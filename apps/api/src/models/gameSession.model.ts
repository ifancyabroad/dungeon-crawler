import { Schema, model, Document } from "mongoose";
import type { GameState } from "@app/shared";

export interface GameSessionDoc extends Document {
	gameId: string;
	tokenHash: string;
	lastSeenAt: Date;
	userId: unknown | null;
	/** Canonical game state snapshot (turn, hero, seed, mapConfig, walkable). */
	state: GameState;
}

const GameSessionSchema = new Schema<GameSessionDoc>(
	{
		gameId: { type: String, required: true, unique: true },
		tokenHash: { type: String, required: true },
		lastSeenAt: { type: Date, required: true },
		userId: { type: Schema.Types.ObjectId, default: null },
		state: { type: Schema.Types.Mixed, required: true },
	},
	{ timestamps: true },
);

GameSessionSchema.index({ tokenHash: 1 });

export const GameSession = model<GameSessionDoc>("GameSession", GameSessionSchema);
