import { Router } from "express";
import gameRoutes from "./game.routes";

const router = Router();

router.get("/health", (_req, res) => res.json({ ok: true }));
router.use("/game", gameRoutes);

export default router;
