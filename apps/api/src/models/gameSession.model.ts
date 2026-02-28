import { Schema, model, Document } from "mongoose";

export interface GameSessionDoc extends Document {
	gameId: string;
	tokenHash: string;
	createdAt: Date;
	lastSeenAt: Date;
	userId: unknown | null;
}

const GameSessionSchema = new Schema<GameSessionDoc>(
	{
		gameId: { type: String, required: true, unique: true },
		tokenHash: { type: String, required: true },
		lastSeenAt: { type: Date, required: true },
		userId: { type: Schema.Types.ObjectId, default: null },
	},
	{ timestamps: true },
);

export const GameSession = model<GameSessionDoc>("GameSession", GameSessionSchema);
