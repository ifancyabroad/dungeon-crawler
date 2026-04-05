const ASSETS_BASE = (import.meta.env.VITE_ASSETS_BASE_URL as string | undefined) ?? "";

export function skillIconUrl(filename: string): string {
	return `${ASSETS_BASE}/static/icons/skills/${filename}`;
}

export function statusIconUrl(filename: string): string {
	return `${ASSETS_BASE}/static/icons/status/${filename}`;
}
