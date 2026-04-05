const ASSETS_BASE = (import.meta.env.VITE_ASSETS_BASE_URL as string | undefined) ?? "";

export function skillIconUrl(filename: string): string {
	return `${ASSETS_BASE}/assets/icons/skills/${filename}`;
}
