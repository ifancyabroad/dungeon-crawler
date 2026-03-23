import { Router } from "express";
import { requireDebugSecret } from "../middlewares/requireDebugSecret";
import { requireGame } from "../middlewares/requireGame";
import {
	setGodMode,
	getGodModeStatus,
	healHero,
	giveSkill,
	killEnemies,
	setXp,
} from "../controllers/debug.controller";

/**
 * Debug routes — available only when DEBUG_SECRET is configured on the server.
 * All routes require requireDebugSecret (matching x-debug-secret header) + requireGame (valid session cookie).
 */
const router = Router();

router.use(requireDebugSecret, requireGame);

router.post("/god-mode", setGodMode);
router.get("/god-mode", getGodModeStatus);
router.post("/heal", healHero);
router.post("/give-skill", giveSkill);
router.post("/kill-enemies", killEnemies);
router.post("/set-xp", setXp);

export default router;
