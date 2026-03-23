import type { RequestHandler } from "express";
import { env } from "../config/env";

/**
 * Rejects requests unless DEBUG_SECRET is configured on the server AND the caller supplies the
 * matching value via the x-debug-secret header. Apply before requireGame on all /api/debug routes.
 */
export const requireDebugSecret: RequestHandler = (req, res, next) => {
	if (!env.DEBUG_SECRET) {
		res.status(403).json({ error: "Debug mode is not enabled on this server." });
		return;
	}

	const provided = req.headers["x-debug-secret"];
	if (provided !== env.DEBUG_SECRET) {
		res.status(403).json({ error: "Forbidden" });
		return;
	}

	next();
};
