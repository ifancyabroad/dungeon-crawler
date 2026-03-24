import { GAME_CONFIG } from "./game";
import { MAP_CONFIG } from "./map";
import { COMBAT_CONFIG } from "./combat";
import { SKILLS_CONFIG } from "./skills";

export const CONFIG = {
	game: GAME_CONFIG,
	map: MAP_CONFIG,
	combat: COMBAT_CONFIG,
	skills: SKILLS_CONFIG,
} as const;
