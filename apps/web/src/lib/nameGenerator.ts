import { nameByRace } from "fantasy-name-generator";

const RACES: string[] = ["human", "elf", "dwarf", "halfling", "gnome", "highelf"];

/** Generate a random fantasy name that fits within 3-10 characters. */
export function randomHeroName(): string {
	for (let attempt = 0; attempt < 20; attempt++) {
		const race = RACES[Math.floor(Math.random() * RACES.length)];
		const result = nameByRace(race, { allowMultipleNames: false });
		if (typeof result === "string" && result.length >= 3 && result.length <= 10) {
			return result;
		}
	}
	return "Adventurer";
}
