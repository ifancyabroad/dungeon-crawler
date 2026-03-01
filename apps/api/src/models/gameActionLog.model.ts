import { Schema, model, Document } from "mongoose";
import type { ActionLogEntry as IActionLogEntry } from "@app/shared";

export interface GameActionLogDoc extends Document, IActionLogEntry {}

const GameActionLogSchema = new Schema<GameActionLogDoc>(
	{
		gameId: { type: String, required: true },
		turn: { type: Number, required: true },
		action: { type: Schema.Types.Mixed, required: true },
		stateHash: { type: String },
	},
	{ timestamps: false },
);

GameActionLogSchema.index({ gameId: 1, turn: 1 }, { unique: true });

export const GameActionLog = model<GameActionLogDoc>("GameActionLog", GameActionLogSchema);
