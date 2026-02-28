import { describe, it, expect } from "vitest";
import { hashToken, verifyToken } from "./gameToken";

describe("hashToken", () => {
	it("returns deterministic output for same inputs", () => {
		const token = "abc";
		const pepper = "pepper";
		expect(hashToken(token, pepper)).toBe(hashToken(token, pepper));
	});

	it("produces 64-char hex string", () => {
		const h = hashToken("x", "y");
		expect(h).toMatch(/^[a-f0-9]{64}$/);
	});
});

describe("verifyToken", () => {
	it("returns true when token and pepper match stored hash", () => {
		const token = "secret-token";
		const pepper = "my-pepper";
		const stored = hashToken(token, pepper);
		expect(verifyToken(token, stored, pepper)).toBe(true);
	});

	it("returns false when token is wrong", () => {
		const pepper = "pepper";
		const stored = hashToken("correct", pepper);
		expect(verifyToken("wrong", stored, pepper)).toBe(false);
	});

	it("returns false when pepper is wrong", () => {
		const token = "token";
		const stored = hashToken(token, "right-pepper");
		expect(verifyToken(token, stored, "wrong-pepper")).toBe(false);
	});

	it("returns false on length mismatch without calling timingSafeEqual", () => {
		const stored = hashToken("a", "b"); // 64-char hex
		const wrongLength = stored.slice(0, 32);
		expect(verifyToken("a", wrongLength, "b")).toBe(false);
	});
});
