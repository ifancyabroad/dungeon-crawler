import type { RequestHandler } from "express";
import { Filter } from "bad-words";

const filter = new Filter();

const ALLOWED_PATTERN = /^[A-Za-z][A-Za-z ' -]*$/;

/**
 * Sanitise and validate heroName on req.body before it reaches the controller.
 * - Trims whitespace
 * - Enforces 3-10 characters
 * - Allows only ASCII letters, spaces, hyphens, apostrophes
 * - Rejects profane names
 * - Capitalises first letter
 */
export const validateHeroName: RequestHandler = (req, res, next) => {
	const raw: unknown = req.body?.heroName;
	if (typeof raw !== "string") {
		return res.status(400).json({ error: "heroName is required" });
	}

	const trimmed = raw.trim();

	if (trimmed.length < 3 || trimmed.length > 10) {
		return res.status(400).json({ error: "Name must be between 3 and 10 characters" });
	}

	if (!ALLOWED_PATTERN.test(trimmed)) {
		return res
			.status(400)
			.json({ error: "Name may only contain letters, spaces, hyphens, and apostrophes" });
	}

	if (filter.isProfane(trimmed)) {
		return res.status(400).json({ error: "That name is not allowed" });
	}

	req.body.heroName = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
	next();
};
