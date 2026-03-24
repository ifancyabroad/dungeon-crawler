export const GAME_CONFIG = {
	visionRadius: 8,
	baseNpcsPerFloor: 5,
	xpPerLevel: [
		0, 0, 50, 120, 220, 350, 520, 740, 1020, 1380, 1840, 2420, 3140, 4020, 5080, 6340, 7840,
		9600, 11650, 14020, 16750,
	] as const,
	leveling: {
		schedule: {
			2: "passive",
			3: "active",
			4: "passive",
			5: "active",
			6: "passive",
			7: "active",
			8: "passive",
			9: "active",
			10: "passive",
		} as const,
		skillOfferCount: 3,
		minHpGainPerLevel: 1,
	},
	ai: {
		ranged: {
			idealRange: 3,
			minRangedSkillRange: 2,
		},
	},
} as const;

export type LevelOfferType = "active" | "passive";

export const VISION_RADIUS = GAME_CONFIG.visionRadius;
export const BASE_NPCS_PER_FLOOR = GAME_CONFIG.baseNpcsPerFloor;
export const XP_PER_LEVEL: readonly number[] = GAME_CONFIG.xpPerLevel;
