import ky, { isHTTPError } from "ky";

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

export const api = ky.create({
	prefixUrl: API_BASE,
	credentials: "include",
	hooks: {
		beforeError: [
			(error) => {
				// ky documents HTTPError.data (parsed response body); typings may not include it
				const err = error as { data?: unknown; message: string };
				if (isHTTPError(error) && err.data != null && typeof err.data === "object") {
					const body = err.data as Record<string, unknown>;
					const msg = body["error"];
					if (typeof msg === "string") err.message = msg;
				}
				return error;
			},
		],
	},
});

/**
 * Origin for Socket.IO. When API_BASE is relative (e.g. /api), in dev we connect to the API server (e.g. :4000).
 * When API_BASE is absolute, use that origin so socket and HTTP share the same host.
 */
export function getSocketUrl(): string {
	if (typeof window === "undefined") return "";
	const base = import.meta.env.VITE_API_BASE_URL;
	if (typeof base === "string" && base.startsWith("http")) return base;
	const { protocol, hostname } = window.location;
	const port = window.location.port;
	if (port === "5173") return `${protocol}//${hostname}:4000`;
	return `${protocol}//${hostname}${port ? `:${port}` : ""}`;
}
