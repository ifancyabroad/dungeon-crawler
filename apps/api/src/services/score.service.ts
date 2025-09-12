import { Score } from "../models/score.model";

export async function listTopScores(limit = 50) {
	return Score.find().sort({ points: -1 }).limit(limit).lean().exec();
}

export async function createScore(data: { player: string; points: number }) {
	const doc = await Score.create(data);
	return doc.toObject();
}
