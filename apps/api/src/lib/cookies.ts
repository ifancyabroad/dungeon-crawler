import type { Request } from "express";

/**
 * Parse Cookie header and return value for the given name, or undefined.
 */
export function getCookie(req: Request, name: string): string | undefined {
	const raw = req.headers.cookie;
	if (!raw) return undefined;
	const match = raw.split(";").find((s) => s.trim().startsWith(name + "="));
	if (!match) return undefined;
	const value = match.slice(name.length + 1).trim();
	return value || undefined;
}
