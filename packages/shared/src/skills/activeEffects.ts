/**
 * Runtime helpers for active effects: inspection and per-turn tick logic.
 *
 * "Active effects" covers all timed states on an actor — both buff-type effects
 * (berserk, stealth) and condition-type effects (poisoned). The data structure
 * is the same; what differs is how the engine processes each effect id, via the
 * registries in statusCombatModifiers.ts and DOT_EFFECT_IDS below.
 *
 * Kept separate from types.ts (pure type re-exports) so that files that only
 * need type information do not pull in runtime code.
 */

import type { Actor, GameEvent, GameState } from "../game/types";
import { applyDamageToActor } from "../combat/applyDamageToActor";
import { STATUS_HOOKS } from "./statusHooks";

/**
 * Returns true if the actor has an active effect with the given id and at
 * least one remaining turn.
 */
export function hasActiveEffect(actor: Actor, id: string): boolean {
	return actor.activeEffects.some((e) => e.id === id && e.remainingTurns > 0);
}

/**
 * Active effect ids that deal damage-over-time each turn via the `value` field.
 *
 * To add a new DoT condition, add its id here — no other changes needed.
 */
const DOT_EFFECT_IDS: Set<string> = new Set([
	STATUS_HOOKS.POISONED,
	STATUS_HOOKS.BURNING,
	STATUS_HOOKS.BLEEDING,
]);

/**
 * Active effect ids that heal each turn via the `value` field.
 *
 * To add a new heal-over-time condition, add its id here — no other changes needed.
 */
const HEAL_EFFECT_IDS: Set<string> = new Set([STATUS_HOOKS.REGENERATING]);

/**
 * Tick down all active effects on every alive actor (hero + NPCs); remove
 * those that have expired. Returns the updated state and any emitted events.
 *
 * DoT effects (e.g. "poisoned") deal `effect.value` damage per turn before the
 * counter is decremented, routed through `applyDamageToActor` so shield
 * absorption and other incoming-damage modifiers are respected consistently.
 */
export function tickActiveEffects(state: GameState): { state: GameState; events: GameEvent[] } {
	const fi = state.heroFloorIndex;
	const floor = state.floors[fi];
	if (!floor) return { state, events: [] };

	const heroId = state.heroId;
	const events: GameEvent[] = [];
	let actorsById: Record<string, Actor> = { ...floor.state.actorsById };

	for (const [actorId, actor] of Object.entries(actorsById)) {
		if (!actor.alive || actor.activeEffects.length === 0) continue;

		const isHero = actorId === heroId;
		const hadStealth = isHero && hasActiveEffect(actor, STATUS_HOOKS.STEALTH);

		let tickedActor: Actor = actor;

		// Apply DoT effects before decrementing so damage fires every active turn.
		for (const effect of tickedActor.activeEffects) {
			if (!tickedActor.alive) break;
			if (!DOT_EFFECT_IDS.has(effect.id) || !effect.value || effect.value <= 0) continue;

			const result = applyDamageToActor(tickedActor, effect.value);
			tickedActor = result.updatedActor;
			events.push(...result.events);
			events.push({ type: "dot_damage", actorId, statusId: effect.id, damage: effect.value });
			if (!tickedActor.alive) {
				events.push({ type: "death", actorId });
			}
		}

		// Apply heal-over-time effects (e.g. regenerating) before decrementing.
		for (const effect of tickedActor.activeEffects) {
			if (!tickedActor.alive) break;
			if (!HEAL_EFFECT_IDS.has(effect.id) || !effect.value || effect.value <= 0) continue;

			const healAmount = Math.min(effect.value, tickedActor.maxHp - tickedActor.hp);
			if (healAmount > 0) {
				tickedActor = { ...tickedActor, hp: tickedActor.hp + healAmount };
				events.push({
					type: "healed",
					actorId,
					amount: healAmount,
					skillId: effect.id,
				});
			}
		}

		const newActiveEffects = tickedActor.activeEffects
			.map((e) => ({ ...e, remainingTurns: e.remainingTurns - 1 }))
			.filter((e) => e.remainingTurns > 0);

		actorsById = {
			...actorsById,
			[actorId]: { ...tickedActor, activeEffects: newActiveEffects },
		};

		// Hero-specific: when stealth expires naturally, alert all NPCs.
		if (isHero) {
			const stealthExpired =
				hadStealth && !newActiveEffects.some((e) => e.id === STATUS_HOOKS.STEALTH);
			if (stealthExpired) {
				for (const [id, npcActor] of Object.entries(actorsById)) {
					if (
						id === heroId ||
						!npcActor.alive ||
						npcActor.def.type !== "npc" ||
						!npcActor.aiState
					)
						continue;
					actorsById = {
						...actorsById,
						[id]: {
							...npcActor,
							aiState: { ...npcActor.aiState!, lastKnownEnemyIdx: actor.idx },
						},
					};
				}
			}
		}
	}

	const newFloors = state.floors.slice();
	newFloors[fi] = {
		...floor,
		state: { ...floor.state, actorsById },
	};

	return { state: { ...state, floors: newFloors }, events };
}
