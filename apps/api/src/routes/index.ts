import { Router } from "express";
import scoreRoutes from "./score.routes";
import gameRoutes from "./game.routes";

const router = Router();

router.get("/health", (_req, res) => res.json({ ok: true }));
router.use("/scores", scoreRoutes);
router.use("/games", gameRoutes);

export default router;
