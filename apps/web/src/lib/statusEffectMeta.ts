/**
 * Display metadata for active status effects shown in the sidebar.
 *
 * STATUS_HOOKS are wired engine conditions (poisoned, burning, etc.) with no source
 * skill — their display data is owned here.
 *
 * Data-driven statuses (berserk, arcane_surge, etc.) carry a `sourceSkillId` set by
 * the engine at application time. Their name, description, icon, and category are
 * resolved directly from the skill definition — no manual mapping needed here.
 */

import { skillsById } from "@app/content";
import type { ActiveEffect } from "@app/shared";

export type StatusEffectCategory = "buff" | "debuff" | "neutral";

export type StatusEffectMeta = {
	name: string;
	description: string;
	category: StatusEffectCategory;
	/** Filename under /static/icons/status/ — only set for STATUS_HOOKS. */
	statusIcon?: string;
	/** Filename under /static/icons/skills/ — only set for data-driven statuses. */
	skillIcon?: string;
};

/** Metadata for STATUS_HOOKS — engine-wired conditions with no source skill definition. */
const STATUS_HOOK_META: Record<string, StatusEffectMeta> = {
	poisoned: {
		name: "Poisoned",
		description: "Taking poison damage each turn.",
		category: "debuff",
		statusIcon: "deadly_potion_nobg.png",
	},
	burning: {
		name: "Burning",
		description: "Taking fire damage each turn.",
		category: "debuff",
		statusIcon: "Skill_Burn_nb.png",
	},
	bleeding: {
		name: "Bleeding",
		description: "Taking piercing damage each turn.",
		category: "debuff",
		statusIcon: "Skill_Bleeding_nb.png",
	},
	stunned: {
		name: "Stunned",
		description: "Cannot act until the effect expires.",
		category: "debuff",
		statusIcon: "skill_3_stuned.png",
	},
	silenced: {
		name: "Silenced",
		description: "Cannot use active skills.",
		category: "debuff",
		statusIcon: "skill_79_silence.png",
	},
	rooted: {
		name: "Rooted",
		description: "Cannot move, but can still attack and use skills.",
		category: "debuff",
		statusIcon: "skill_133_root.png",
	},
	revealed: {
		name: "Revealed",
		description: "Stealth concealment is stripped — enemies can see you normally.",
		category: "debuff",
		statusIcon: "skill_72_noBG.png",
	},
	frightened: {
		name: "Frightened",
		description: "Cannot move toward the source of fear.",
		category: "debuff",
		statusIcon: "Fear.png",
	},
	charmed: {
		name: "Charmed",
		description: "Cannot attack the charmer. Regards them as a friendly acquaintance.",
		category: "neutral",
		statusIcon: "Aura_KissLove_nb.png",
	},
	stealth: {
		name: "Stealth",
		description: "Hidden from enemies. Alerts nearby NPCs on expiry.",
		category: "buff",
		statusIcon: "Skill_HideInForest_nb.png",
	},
	regenerating: {
		name: "Regenerating",
		description: "Recovering HP each turn.",
		category: "buff",
		statusIcon: "skill_134_noBG.png",
	},
};

function humanizeWord(w: string): string {
	return w.charAt(0).toUpperCase() + w.slice(1);
}

export function humanizeStatusId(id: string): string {
	return id.split("_").filter(Boolean).map(humanizeWord).join(" ");
}

function categoryFromTags(tags: readonly string[]): StatusEffectCategory {
	if (tags.includes("buff")) return "buff";
	if (tags.includes("debuff")) return "debuff";
	return "neutral";
}

export function getStatusEffectMeta(effect: ActiveEffect): StatusEffectMeta {
	// STATUS_HOOKS take priority — their identity is the effect id, regardless of source.
	const hook = STATUS_HOOK_META[effect.id];
	if (hook) return hook;

	// Data-driven status — resolve directly from the source skill.
	if (effect.sourceSkillId) {
		const def = skillsById[effect.sourceSkillId as keyof typeof skillsById];
		if (def) {
			return {
				name: def.name,
				description: def.description,
				category: categoryFromTags(def.tags),
				skillIcon: def.icon,
			};
		}
	}

	// Unknown status — best-effort fallback.
	return {
		name: humanizeStatusId(effect.id),
		description: "An active status effect.",
		category: "neutral",
	};
}
