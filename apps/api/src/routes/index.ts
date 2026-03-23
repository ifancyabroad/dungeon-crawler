import { Router } from "express";
import gameRoutes from "./game.routes";
import debugRoutes from "./debug.routes";

const router = Router();

router.get("/health", (_req, res) => res.json({ ok: true }));
router.use("/game", gameRoutes);
router.use("/debug", debugRoutes);

export default router;
