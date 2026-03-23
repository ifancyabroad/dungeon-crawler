import type { Actor, ActorId, GameEvent, PendingInteraction } from "./types";
import { XP_PER_LEVEL } from "./config";
import type { Rng } from "../rng";
import type { ApplyActionContext } from "./engineContext";

/**
 * Configurable schedule for level-up offer types.
 * Keys are level numbers (1-indexed). Missing levels repeat the last seen pattern.
 * Default: first level-up (reaching level 2) is passive, then alternates.
 */
export const LEVEL_UP_SCHEDULE: Record<number, "active" | "passive"> = {
	2: "passive",
	3: "active",
	4: "passive",
	5: "active",
	6: "passive",
	7: "active",
	8: "passive",
	9: "active",
	10: "passive",
};

function getOfferTypeForLevel(level: number): "active" | "passive" {
	if (level in LEVEL_UP_SCHEDULE) return LEVEL_UP_SCHEDULE[level]!;
	// Beyond schedule: alternate based on parity (even = passive, odd = active)
	return level % 2 === 0 ? "passive" : "active";
}

/**
 * Sample up to `count` items from `pool` without replacement using deterministic RNG.
 * Fisher-Yates partial shuffle.
 */
export function sampleWithoutReplacement(pool: string[], count: number, rng: Rng): string[] {
	const arr = pool.slice();
	const result: string[] = [];
	const take = Math.min(count, arr.length);
	for (let i = 0; i < take; i++) {
		const j = i + Math.floor(rng() * (arr.length - i));
		const temp = arr[i]!;
		arr[i] = arr[j]!;
		arr[j] = temp;
		result.push(arr[i]!);
	}
	return result;
}

/**
 * Award XP to an actor for a kill, levelling them up if the threshold is crossed.
 * Returns the updated actor, any level_up events, and a pendingInteraction to set
 * on the game state if a level-up occurred and skill offers could be generated.
 */
export function grantXpForKill(
	actor: Actor,
	actorId: ActorId,
	xpReward: number,
	rng: Rng,
	context: ApplyActionContext,
): { actor: Actor; events: GameEvent[]; pendingInteraction: PendingInteraction } {
	if (xpReward <= 0) return { actor, events: [], pendingInteraction: null };
	const events: GameEvent[] = [];
	let newXp = actor.xp + xpReward;
	let newLevel = actor.level;
	let newMaxHp = actor.maxHp;
	let newCurrentHp = actor.hp;

	const nextLevelXp = XP_PER_LEVEL[newLevel + 1] ?? Infinity;
	let pendingInteraction: PendingInteraction = null;

	if (newXp >= nextLevelXp) {
		newXp -= nextLevelXp;
		newLevel += 1;
		const conMod = Math.floor((actor.attributes.constitution - 10) / 2);
		const roll = Math.floor(rng() * actor.hitDie) + 1;
		const hpGained = Math.max(1, roll + conMod);
		newMaxHp += hpGained;
		newCurrentHp += hpGained;
		events.push({ type: "level_up", actorId, newLevel, hpGained });

		// Generate deterministic level-up skill offers
		const classId = actor.def.type === "hero" ? actor.def.classId : null;
		const pools = classId ? context.getClassSkillPools(classId) : undefined;
		if (pools) {
			const offerType = getOfferTypeForLevel(newLevel);
			const pool = offerType === "active" ? pools.activeSkillPool : pools.passiveSkillPool;
			// Filter out skills the hero already owns
			const ownedSkillIds = new Set(Object.keys(actor.skills));
			const eligible = pool.filter((id) => !ownedSkillIds.has(id));
			const offers = sampleWithoutReplacement(eligible, 3, rng);
			if (offers.length > 0) {
				pendingInteraction = {
					type: "skill_choice",
					offerType,
					levelReached: newLevel,
					offers,
					rerollsUsed: 0,
				};
			}
		}
	}

	return {
		actor: { ...actor, xp: newXp, level: newLevel, maxHp: newMaxHp, hp: newCurrentHp },
		events,
		pendingInteraction,
	};
}
