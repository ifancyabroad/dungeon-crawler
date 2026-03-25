import type {
	Actor,
	ActorId,
	FloorConfig,
	FloorState,
	GameState,
	HeroInit,
	NpcInit,
} from "./types";
import { VISION_RADIUS } from "../config/game";
import { createInitialRngState } from "../rng";
import { regenerateBaseMaps, type BaseLayerFloor } from "../map";
import { computeOpacityMask, computeVisibility, mergeExplored } from "../map/visibility";
import { computeUnarmoredAC } from "../combat/dice";
import { type NpcAIState } from "./strategies/types";
import { idxToXY } from "./engineUtils";
import { MAP_GEN_VERSION } from "../config/map";

const DEFAULT_ATTRIBUTES = {
	strength: 10,
	dexterity: 10,
	constitution: 10,
	intelligence: 10,
	wisdom: 10,
	charisma: 10,
} as const;

/** Fallback hero init for tests and debug. Matches legacy hardcoded warrior. */
export const DEFAULT_HERO_INIT: HeroInit = {
	name: "Hero",
	classId: "warrior",
	hp: 100,
	maxHp: 100,
	attributes: { ...DEFAULT_ATTRIBUTES },
	level: 1,
	xp: 0,
	hitDie: 10,
	savingThrowProficiencies: ["strength", "constitution"],
	skills: [],
};

/**
 * Build a single floor's initial state from its base layer.
 * Pass heroInit to populate the hero actor and initial visibility on the spawn tile.
 * Pass null for floors the hero doesn't start on (they'll receive NPCs lazily).
 */
function buildInitialFloorState(
	base: BaseLayerFloor,
	config: FloorConfig,
	heroInit: HeroInit | null,
): FloorState {
	const { spawnIdx } = base;
	const exitIdx = base.exitIdx === -1 ? null : base.exitIdx;

	if (!heroInit) {
		return { tileOverrides: {}, actorsById: {}, explored: [], spawnIdx, exitIdx };
	}

	const initialSkills: Record<string, { cooldownRemaining: number }> = {};
	for (const skillId of heroInit.skills ?? []) {
		initialSkills[skillId] = { cooldownRemaining: 0 };
	}

	const heroActor: Actor = {
		id: "hero",
		name: heroInit.name,
		idx: spawnIdx,
		alive: true,
		hp: heroInit.hp,
		maxHp: heroInit.maxHp,
		armorClass: heroInit.armorClass ?? computeUnarmoredAC(heroInit.attributes.dexterity),
		attributes: { ...heroInit.attributes },
		damageResistances: [],
		damageImmunities: [],
		damageVulnerabilities: [],
		skills: initialSkills,
		activeEffects: [],
		numericBuffs: {},
		passiveDamageBonuses: [],
		statusImmunities: [],
		savingThrowProficiencies: heroInit.savingThrowProficiencies,
		faction: "player",
		def: { type: "hero", classId: heroInit.classId },
		level: heroInit.level,
		xp: heroInit.xp,
		hitDie: heroInit.hitDie,
		xpReward: 0,
	};

	const { x: spawnX, y: spawnY } = idxToXY(spawnIdx, config.width);
	const opMask = computeOpacityMask(base.wall, config.width, config.height);
	const visible = computeVisibility(
		spawnX,
		spawnY,
		config.width,
		config.height,
		opMask,
		VISION_RADIUS,
	);
	const explored = mergeExplored([], visible, config.width * config.height);

	return {
		tileOverrides: {},
		actorsById: { hero: heroActor } as Record<ActorId, Actor>,
		explored,
		spawnIdx,
		exitIdx,
	};
}

/**
 * Create initial game state: all floors pre-generated, hero on floor 0.
 * Floors 1–N are empty (no actors); NPCs are spawned lazily on first visit by the API.
 */
export function createInitialState(
	seed: number,
	floorConfigs: FloorConfig[],
	hero: HeroInit,
): GameState {
	const rngState = createInitialRngState(seed);
	const baseLayers = regenerateBaseMaps(seed, floorConfigs, MAP_GEN_VERSION);

	const floors = floorConfigs.map((config, i) => ({
		config,
		state: buildInitialFloorState(baseLayers[i]!, config, i === 0 ? hero : null),
	}));

	return {
		turn: 0,
		heroId: "hero",
		heroFloorIndex: 0,
		seed,
		mapGenVersion: MAP_GEN_VERSION,
		floors,
		rngState,
		pendingInteraction: null,
	};
}

/** Generate a deterministic actor ID for an NPC spawn. */
let _npcCounter = 0;
export function resetNpcCounter(): void {
	_npcCounter = 0;
}
function nextNpcId(npcId: string): string {
	return `${npcId}_${_npcCounter++}`;
}

/** Spawn an NPC on a floor and return the updated state. */
export function spawnNpc(
	state: GameState,
	floorIndex: number,
	init: NpcInit,
	idx: number,
): GameState {
	const floor = state.floors[floorIndex];
	if (!floor) return state;
	const aiState: NpcAIState = {
		combatStrategy: init.combatStrategy,
		idleStrategy: init.idleStrategy,
	};
	const actor: Actor = {
		id: nextNpcId(init.npcId),
		name: init.name,
		idx,
		alive: true,
		hp: init.hp,
		maxHp: init.maxHp,
		armorClass: init.armorClass,
		attributes: { ...init.attributes },
		damageResistances: [...init.damageResistances],
		damageImmunities: [...init.damageImmunities],
		damageVulnerabilities: [...init.damageVulnerabilities],
		skills: Object.fromEntries(init.activeSkills.map((id) => [id, { cooldownRemaining: 0 }])),
		activeEffects: [],
		numericBuffs: {},
		passiveDamageBonuses: [],
		statusImmunities: [],
		savingThrowProficiencies: init.savingThrowProficiencies,
		challengeRating: init.challengeRating,
		faction: init.faction,
		def: { type: "npc", npcId: init.npcId },
		level: 0,
		xp: 0,
		hitDie: 0,
		xpReward: init.xpReward,
		aiState,
	};
	const newActorsById = { ...floor.state.actorsById, [actor.id]: actor };
	const newFloorState: FloorState = { ...floor.state, actorsById: newActorsById };
	const newFloors = state.floors.slice();
	newFloors[floorIndex] = { ...floor, state: newFloorState };
	return { ...state, floors: newFloors };
}
