/** Valid floor theme identifiers. Single source of truth — all consumers import from here. */
export const FLOOR_THEMES = [
	"green_forest",
	"orange_forest",
	"yellow_forest",
	"dark_forest",
] as const;

export type FloorTheme = (typeof FLOOR_THEMES)[number];
