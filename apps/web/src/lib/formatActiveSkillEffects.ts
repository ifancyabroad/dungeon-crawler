import type { ActiveSkillDefinition, ActiveSkillEffectDescriptor } from "@app/shared";

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

function scalingSuffix(stat?: string): string {
	return stat ? ` + ${stat} modifier` : "";
}

function onHitSuffix(s?: { statusId: string; durationTurns: number }): string {
	if (!s) return "";
	return `, applies ${humanizeId(s.statusId)} (${s.durationTurns} turn${s.durationTurns !== 1 ? "s" : ""}) on hit`;
}

function saveSuffix(s?: { saveAbility: string; successDamageMultiplier?: number }): string {
	if (!s) return "";
	return ` (${titleCaseWord(s.saveAbility)} save for half)`;
}

function bonusDmgSuffix(dice?: string, damageType?: string): string {
	if (!dice || !damageType) return "";
	return ` + ${dice} ${titleCaseWord(damageType)}`;
}

/**
 * Single-line summary of one active skill effect descriptor.
 */
export function formatActiveSkillEffectLine(effect: ActiveSkillEffectDescriptor): string {
	function dmg(dice?: string, damageType?: string): string {
		if (dice && damageType) return `${dice} ${titleCaseWord(damageType)}`;
		if (dice) return `${dice} weapon`;
		return "weapon";
	}
	switch (effect.type) {
		case "single_target_damage":
			return `${dmg(effect.dice, effect.damageType)}${bonusDmgSuffix(effect.bonusDice, effect.bonusDamageType)} damage${scalingSuffix(effect.scalingStat)}${saveSuffix(effect.savingThrow)}${onHitSuffix(effect.onHitStatus)}`;
		case "area_damage":
			return `${dmg(effect.dice, effect.damageType)}${bonusDmgSuffix(effect.bonusDice, effect.bonusDamageType)} damage (radius ${effect.radiusTiles})${scalingSuffix(effect.scalingStat)}${saveSuffix(effect.savingThrow)}`;
		case "cone_damage":
			return `${dmg(effect.dice, effect.damageType)}${bonusDmgSuffix(effect.bonusDice, effect.bonusDamageType)} damage in a cone${scalingSuffix(effect.scalingStat)}${saveSuffix(effect.savingThrow)}`;
		case "line_damage":
			return `${effect.dice} ${titleCaseWord(effect.damageType)} damage in a line${scalingSuffix(effect.scalingStat)}${saveSuffix(effect.savingThrow)}`;
		case "leap_attack":
			return `Leap up to ${effect.maxRangeTiles} tiles — ${dmg(effect.dice, effect.damageType)}${bonusDmgSuffix(effect.bonusDice, effect.bonusDamageType)} on landing${scalingSuffix(effect.scalingStat)}`;
		case "charge_attack":
			return `Charge up to ${effect.maxRangeTiles} tiles — +${effect.bonusDice} ${titleCaseWord(effect.bonusDamageType)} bonus damage`;
		case "sneak_attack":
			return `${effect.dice} bonus weapon damage`;
		case "multi_strike":
			return `${effect.strikeCount}\u00d7 ${dmg(effect.dice, effect.damageType)}${bonusDmgSuffix(effect.bonusDice, effect.bonusDamageType)} damage${scalingSuffix(effect.scalingStat)}${onHitSuffix(effect.onHitStatus)}`;
		case "drain_life":
			return `${effect.dice} ${titleCaseWord(effect.damageType)} damage, heal ${effect.healDice}`;
		case "heal_self":
			return `Heal ${effect.dice} HP${scalingSuffix(effect.scalingStat)}`;
		case "heal_target":
			return `Heal target ${effect.dice} HP${scalingSuffix(effect.scalingStat)}`;
		case "push_actor": {
			const wall =
				effect.wallDamageDice && effect.wallDamageType
					? ` (${effect.wallDamageDice} ${titleCaseWord(effect.wallDamageType)} on wall collision)`
					: "";
			return `Push target up to ${effect.maxPushTiles} tiles${wall}`;
		}
		case "pull_actor": {
			const wall =
				effect.wallDamageDice && effect.wallDamageType
					? ` (${effect.wallDamageDice} ${titleCaseWord(effect.wallDamageType)} on wall collision)`
					: "";
			return `Pull target up to ${effect.maxPullTiles} tiles${wall}`;
		}
		case "apply_status":
			return `Apply ${humanizeId(effect.statusId)} (${effect.durationTurns} turn${effect.durationTurns !== 1 ? "s" : ""})`;
		case "remove_status":
			return `Remove ${effect.statusIds.map(humanizeId).join(", ")}`;
		case "apply_shield":
			return `Gain ${effect.amount} shield HP`;
		case "shadow_step":
			return "Teleport to target tile";
		case "teleport_swap":
			return "Swap positions with target";
		case "reduce_cooldowns":
			return `Reduce cooldowns by ${effect.amount} turn${effect.amount !== 1 ? "s" : ""}`;
		case "modify_numeric_buff":
			return `Modify ${humanizeId(effect.key)}`;
	}
}

/**
 * Human-readable effect lines for the hero's current rank (uses full rank entry from
 * `effectsByRank`, not engine deltas).
 */
export function formatActiveEffectsAtRank(def: ActiveSkillDefinition, rank: number): string[] {
	const idx = Math.max(0, Math.min(2, rank - 1));
	const effects = def.effectsByRank[idx] ?? def.effectsByRank[0];
	return effects.map((e) => formatActiveSkillEffectLine(e));
}
