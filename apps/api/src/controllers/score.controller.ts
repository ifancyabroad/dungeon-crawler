import type { RequestHandler } from "express";
import { listTopScores, createScore } from "../services/score.service";
import { ScoreSchema } from "@app/shared";

export const getScores: RequestHandler = async (_req, res) => {
	const scores = await listTopScores();
	res.json(scores);
};

export const postScore: RequestHandler = async (req, res) => {
	const data = ScoreSchema.parse(req.body);
	const created = await createScore(data);
	res.status(201).json(created);
};
