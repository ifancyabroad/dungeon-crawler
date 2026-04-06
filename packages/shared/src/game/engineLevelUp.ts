import type { Actor, ActorId, GameEvent, PendingInteraction, SkillOffer } from "./types";
import type { Rng } from "../rng";
import type { ClassSkillPools } from "./engineContext";
import { GAME_CONFIG, XP_PER_LEVEL } from "../config";

/**
 * Build the list of skill offers a player can choose from at level-up.
 *
 * Rules:
 * - A skill can be offered as "new" (rank 1) only if the hero does not own it yet
 *   and the per-type cap has not been reached.
 * - A skill can be offered as an upgrade only if the hero already owns it at a
 *   rank below the maximum.
 * - The offer set always contains at least 1 active and 1 passive (if candidates
 *   are available for each type).
 * - The third slot is filled by a weighted draw that biases toward whichever type
 *   the hero has fewer of so far.
 */
export function generateSkillOffers(
	actor: Actor,
	pools: ClassSkillPools,
	rng: Rng,
	excludeSkillIds: ReadonlySet<string> = new Set(),
): SkillOffer[] {
	const { activeSkillCap, passiveSkillCap, maxSkillRank, skillOfferCount } = GAME_CONFIG.leveling;

	// Count how many active / passive skills the hero currently holds (from class pools).
	const activeCount = pools.activeSkillPool.filter((id) => id in actor.skills).length;
	const passiveCount = pools.passiveSkillPool.filter((id) => id in actor.skills).length;

	function buildCandidates(
		pool: readonly string[],
		ownedCount: number,
		typeCap: number,
	): SkillOffer[] {
		const candidates: SkillOffer[] = [];
		for (const skillId of pool) {
			if (excludeSkillIds.has(skillId)) continue;
			const owned = actor.skills[skillId];
			if (!owned) {
				if (ownedCount < typeCap) candidates.push({ skillId, rank: 1 });
			} else if (owned.rank < maxSkillRank) {
				candidates.push({ skillId, rank: owned.rank + 1 });
			}
		}
		return candidates;
	}

	const activeCandidates = buildCandidates(pools.activeSkillPool, activeCount, activeSkillCap);
	const passiveCandidates = buildCandidates(
		pools.passiveSkillPool,
		passiveCount,
		passiveSkillCap,
	);

	const offers: SkillOffer[] = [];
	const usedSkillIds = new Set<string>();

	function pickOne(candidates: SkillOffer[]): SkillOffer | undefined {
		const available = candidates.filter((o) => !usedSkillIds.has(o.skillId));
		if (available.length === 0) return undefined;
		const idx = Math.floor(rng() * available.length);
		return available[idx];
	}

	// Guarantee at least 1 active and 1 passive
	const firstActive = pickOne(activeCandidates);
	if (firstActive) {
		offers.push(firstActive);
		usedSkillIds.add(firstActive.skillId);
	}

	const firstPassive = pickOne(passiveCandidates);
	if (firstPassive) {
		offers.push(firstPassive);
		usedSkillIds.add(firstPassive.skillId);
	}

	// Fill remaining slots with a type-weighted draw
	while (offers.length < skillOfferCount) {
		const remainingActive = activeCandidates.filter((o) => !usedSkillIds.has(o.skillId));
		const remainingPassive = passiveCandidates.filter((o) => !usedSkillIds.has(o.skillId));
		if (remainingActive.length === 0 && remainingPassive.length === 0) break;

		// Bias toward the less-represented type (2:1 weight ratio when counts differ)
		const activeWeight = activeCount <= passiveCount ? 2 : 1;
		const passiveWeight = passiveCount <= activeCount ? 2 : 1;

		const weightedPool: SkillOffer[] = [
			...Array.from({ length: activeWeight }, () => remainingActive).flat(),
			...Array.from({ length: passiveWeight }, () => remainingPassive).flat(),
		];

		const idx = Math.floor(rng() * weightedPool.length);
		const pick = weightedPool[idx];
		if (pick && !usedSkillIds.has(pick.skillId)) {
			offers.push(pick);
			usedSkillIds.add(pick.skillId);
		} else {
			continue;
		}
	}

	return offers;
}

/**
 * Check whether an actor's current XP crosses the next level threshold and, if so,
 * apply the level-up (HP roll, level increment, XP deduction, skill offer generation).
 * Call this after XP has already been added to `actor.xp`.
 */
export function checkForLevelUp(
	actor: Actor,
	actorId: ActorId,
	rng: Rng,
	getClassSkillPools: (classId: string) => ClassSkillPools | undefined,
): { actor: Actor; events: GameEvent[]; pendingInteraction: PendingInteraction } {
	const nextLevelXp = XP_PER_LEVEL[actor.level + 1] ?? Infinity;
	if (actor.xp < nextLevelXp) return { actor, events: [], pendingInteraction: null };

	const events: GameEvent[] = [];
	const newXp = actor.xp - nextLevelXp;
	const newLevel = actor.level + 1;
	const conMod = Math.floor((actor.attributes.constitution - 10) / 2);
	const roll = Math.floor(rng() * actor.hitDie) + 1;
	const hpGained = Math.max(GAME_CONFIG.leveling.minHpGainPerLevel, roll + conMod);
	const newMaxHp = actor.maxHp + hpGained;
	const newCurrentHp = actor.hp + hpGained;
	events.push({ type: "level_up", actorId, newLevel, hpGained });

	let pendingInteraction: PendingInteraction = null;
	const classId = actor.def.type === "hero" ? actor.def.classId : null;
	const pools = classId ? getClassSkillPools(classId) : undefined;
	if (pools) {
		const offers = generateSkillOffers(actor, pools, rng);
		if (offers.length > 0) {
			pendingInteraction = {
				type: "skill_choice",
				levelReached: newLevel,
				hpGained,
				offers,
				rerollsUsed: 0,
				rerollCost: 15,
			};
		}
	}

	return {
		actor: { ...actor, xp: newXp, level: newLevel, maxHp: newMaxHp, hp: newCurrentHp },
		events,
		pendingInteraction,
	};
}

/**
 * Award XP to an actor, levelling them up if the threshold is crossed.
 * Returns the updated actor, any level_up events, and a pendingInteraction to set
 * on the game state if a level-up occurred and skill offers could be generated.
 */
export function grantXp(
	actor: Actor,
	actorId: ActorId,
	xpAmount: number,
	rng: Rng,
	getClassSkillPools: (classId: string) => ClassSkillPools | undefined,
): { actor: Actor; events: GameEvent[]; pendingInteraction: PendingInteraction } {
	if (xpAmount <= 0) return { actor, events: [], pendingInteraction: null };
	return checkForLevelUp({ ...actor, xp: actor.xp + xpAmount }, actorId, rng, getClassSkillPools);
}
