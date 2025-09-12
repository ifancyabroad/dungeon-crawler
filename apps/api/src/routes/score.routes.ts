import { Router } from "express";
import { getScores, postScore } from "../controllers/score.controller";

const router = Router();

router.get("/", getScores);
router.post("/", postScore);

export default router;
