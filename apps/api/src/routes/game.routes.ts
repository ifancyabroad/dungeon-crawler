import { Router } from "express";
import { createGame, getGame } from "../controllers/game.controller";
import { gameAuth } from "../middlewares/gameAuth";

/**
 * Game session routes. One active game per browser: POST /games overwrites
 * the game_token cookie so the new game becomes the single "current run" on that device.
 *
 * Future: socket.io will authenticate via the same game_token HttpOnly cookie
 * (cookie-based auth on connect). No implementation yet.
 */
const router = Router();

router.post("/", createGame);
router.get("/:gameId", gameAuth, getGame);

export default router;
