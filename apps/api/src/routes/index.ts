import { Router } from "express";
import scoreRoutes from "./score.routes";

const router = Router();

router.get("/health", (_req, res) => res.json({ ok: true }));
router.use("/scores", scoreRoutes);

export default router;
