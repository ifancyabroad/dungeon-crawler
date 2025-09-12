import { Schema, model, Document } from "mongoose";

export interface ScoreDoc extends Document {
	player: string;
	points: number;
	createdAt: Date;
	updatedAt: Date;
}

const ScoreSchema = new Schema<ScoreDoc>(
	{
		player: { type: String, required: true, trim: true },
		points: { type: Number, required: true, min: 0 },
	},
	{ timestamps: true },
);

export const Score = model<ScoreDoc>("Score", ScoreSchema);
