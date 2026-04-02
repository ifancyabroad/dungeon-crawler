import type { PassiveSkillDefinition, PassiveSkillEffectDescriptor } from "@app/shared";

function titleCaseWord(s: string): string {
	if (!s) return s;
	return s.charAt(0).toUpperCase() + s.slice(1);
}

function humanizeId(id: string): string {
	return id
		.split("_")
		.filter(Boolean)
		.map((w) => titleCaseWord(w))
		.join(" ");
}

/**
 * Single-line summary of one passive effect entry at a given rank (from content).
 */
export function formatPassiveSkillEffectLine(effect: PassiveSkillEffectDescriptor): string {
	switch (effect.type) {
		case "modify_attribute": {
			const sign = effect.amount >= 0 ? "+" : "";
			return `${sign}${effect.amount} ${titleCaseWord(effect.attribute)}`;
		}
		case "modify_armor_class": {
			const sign = effect.amount >= 0 ? "+" : "";
			return `${sign}${effect.amount} AC`;
		}
		case "add_damage_resistance":
			return `Resistance to ${titleCaseWord(effect.damageType)}`;
		case "add_damage_immunity":
			return `Immunity to ${titleCaseWord(effect.damageType)}`;
		case "add_damage_dice": {
			const scope = effect.appliesTo;
			const crit = effect.onCritOnly ? " (critical hits only)" : "";
			return `+${effect.dice} ${titleCaseWord(effect.damageType)} on ${scope} attacks${crit}`;
		}
		case "add_status_immunity":
			return `Immune to ${humanizeId(effect.statusId)}`;
		case "modify_max_hp":
			return `+${effect.amount} max HP`;
		case "modify_hit_die":
			return `Hit die becomes d${effect.die}`;
		case "add_saving_throw_proficiency":
			return `Proficiency on ${titleCaseWord(effect.ability)} saves`;
		case "add_attack_roll_bonus":
			return `+${effect.amount} to attack rolls`;
		case "modify_crit_threshold": {
			const minNatural = Math.max(1, 20 - effect.reduction);
			return `Critical hits on natural ${minNatural}+`;
		}
		case "add_damage_vulnerability":
			return `Vulnerable to ${titleCaseWord(effect.damageType)}`;
		case "add_healing_bonus_flat":
			return `+${effect.amount} to healing you apply`;
		case "add_dot_amplify_flat":
			return `+${effect.amount} to DoT damage you apply`;
		case "add_flat_damage_bonus": {
			const scope = effect.appliesTo;
			return `+${effect.amount} ${titleCaseWord(effect.damageType)} on ${scope} attacks`;
		}
	}
}

/**
 * Human-readable effect lines for the hero's current rank (uses full rank entry from
 * `effectsByRank`, not engine deltas).
 */
export function formatPassiveEffectsAtRank(def: PassiveSkillDefinition, rank: number): string[] {
	const idx = Math.max(0, Math.min(2, rank - 1));
	const effects = def.effectsByRank[idx] ?? def.effectsByRank[0];
	return effects.map((e) => formatPassiveSkillEffectLine(e));
}
