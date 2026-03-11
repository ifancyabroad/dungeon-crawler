import { Router } from "express";
import { createGame, getGame, getGameStatus } from "../controllers/game.controller";
import { requireGame } from "../middlewares/requireGame";
import { validateHeroName } from "../middlewares/validateHeroName";

/**
 * Game session: POST /api/game creates (sets cookie), GET /api/game returns current by cookie.
 * One active game per browser. Socket.io authenticates via the same game_token HttpOnly cookie on join.
 */
const router = Router();

router.post("/", validateHeroName, createGame);
router.get("/", requireGame, getGame);
router.get("/status", getGameStatus);

export default router;
