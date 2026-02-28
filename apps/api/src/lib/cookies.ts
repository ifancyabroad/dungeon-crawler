import type { Request } from "express";

/**
 * Parse cookie string and return value for the given name, or undefined.
 * Use for Cookie header string (e.g. socket handshake).
 */
export function parseCookie(cookieHeader: string | undefined, name: string): string | undefined {
	if (!cookieHeader) return undefined;
	const match = cookieHeader.split(";").find((s) => s.trim().startsWith(name + "="));
	if (!match) return undefined;
	const value = match.slice(name.length + 1).trim();
	return value || undefined;
}

/**
 * Parse Cookie header from request and return value for the given name, or undefined.
 */
export function getCookie(req: Request, name: string): string | undefined {
	const raw = req.headers.cookie;
	return parseCookie(typeof raw === "string" ? raw : undefined, name);
}
