export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

export async function apiFetch<T>(
	path: string,
	init?: RequestInit & { signal?: AbortSignal },
): Promise<T> {
	const res = await fetch(`${API_BASE}${path}`, {
		headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
		...init,
	});
	if (!res.ok) {
		let message = `HTTP ${res.status}`;
		try {
			const body = await res.json();
			message = body?.error || message;
		} catch {
			throw new Error(message);
		}
	}
	return res.json() as Promise<T>;
}
