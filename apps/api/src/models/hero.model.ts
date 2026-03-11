import { Schema, model, Document } from "mongoose";

export type HeroStatus = "active" | "dead" | "retired";

export interface IHeroDoc {
	gameId: string;
	tokenHash: string;
	name: string;
	classId: string;
	status: HeroStatus;
	createdAt: Date;
}

export interface HeroDoc extends Document, IHeroDoc {}

const HeroSchema = new Schema<HeroDoc>(
	{
		gameId: { type: String, required: true },
		tokenHash: { type: String, required: true },
		name: { type: String, required: true },
		classId: { type: String, required: true },
		status: { type: String, enum: ["active", "dead", "retired"], required: true },
	},
	{ timestamps: true },
);

HeroSchema.index({ tokenHash: 1 });
HeroSchema.index({ gameId: 1, status: 1 });

export const Hero = model<HeroDoc>("Hero", HeroSchema);
