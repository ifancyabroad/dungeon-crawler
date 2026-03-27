const RANK_ROMAN = ["I", "II", "III"] as const;

/** Roman numeral glyph for skill rank (1–3). */
export function rankRoman(rank: number): string {
	const i = Math.max(0, Math.min(2, rank - 1));
	return RANK_ROMAN[i];
}
