import { Router } from "express";
import { createGame, getGame } from "../controllers/game.controller";
import { requireGame } from "../middlewares/requireGame";

/**
 * Game session: POST /api/game creates (sets cookie), GET /api/game returns current by cookie.
 * One active game per browser. Socket.io authenticates via the same game_token HttpOnly cookie on join.
 */
const router = Router();

router.post("/", createGame);
router.get("/", requireGame, getGame);

export default router;
