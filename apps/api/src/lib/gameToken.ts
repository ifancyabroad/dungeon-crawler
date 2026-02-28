import { createHash, timingSafeEqual } from "node:crypto";

/**
 * SHA-256(token + pepper). Never log the token.
 */
export function hashToken(token: string, pepper: string): string {
	return createHash("sha256")
		.update(token + pepper, "utf8")
		.digest("hex");
}

/**
 * Timing-safe comparison. Returns false if lengths differ (do not call timingSafeEqual with mismatched lengths).
 * Never log the token.
 */
export function verifyToken(token: string, tokenHash: string, pepper: string): boolean {
	const computed = hashToken(token, pepper);
	if (tokenHash.length !== computed.length) return false;
	const a = Buffer.from(tokenHash, "hex");
	const b = Buffer.from(computed, "hex");
	if (a.length !== b.length) return false;
	return timingSafeEqual(a, b);
}
