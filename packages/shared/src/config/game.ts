export const GAME_CONFIG = {
	visionRadius: 8,
	baseNpcsPerFloor: 5,
	xpPerLevel: [
		0, 0, 50, 120, 220, 350, 520, 740, 1020, 1380, 1840, 2420, 3140, 4020, 5080, 6340, 7840,
		9600, 11650, 14020, 16750,
	] as const,
	leveling: {
		skillOfferCount: 3,
		activeSkillCap: 5,
		passiveSkillCap: 5,
		maxSkillRank: 3,
		minHpGainPerLevel: 1,
	},
	ai: {
		ranged: {
			idealRange: 3,
			minRangedSkillRange: 2,
		},
	},
} as const;

export const VISION_RADIUS = GAME_CONFIG.visionRadius;
export const BASE_NPCS_PER_FLOOR = GAME_CONFIG.baseNpcsPerFloor;
export const XP_PER_LEVEL: readonly number[] = GAME_CONFIG.xpPerLevel;
