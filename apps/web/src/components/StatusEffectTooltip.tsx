import type { ActiveEffect, CombatAdjustments } from "@app/shared";
import { getStatusEffectMeta } from "../lib/statusEffectMeta";

type StatusEffectTooltipProps = {
	effect: ActiveEffect;
};

function formatAdjustmentLines(adj: CombatAdjustments): string[] {
	const lines: string[] = [];
	if (adj.acBonus !== undefined) {
		lines.push(adj.acBonus >= 0 ? `AC +${adj.acBonus}` : `AC ${adj.acBonus}`);
	}
	if (adj.incomingDamageFlat !== undefined) {
		lines.push(
			adj.incomingDamageFlat >= 0
				? `Incoming damage +${adj.incomingDamageFlat}`
				: `Incoming damage ${adj.incomingDamageFlat}`,
		);
	}
	if (adj.meleeDamageDiceBonus) lines.push(`Melee damage +${adj.meleeDamageDiceBonus}`);
	if (adj.rangedDamageDiceBonus) lines.push(`Ranged damage +${adj.rangedDamageDiceBonus}`);
	if (adj.areaDamageDiceBonus) lines.push(`Area damage +${adj.areaDamageDiceBonus}`);
	if (adj.meleeDamageFlat) {
		const { amount, damageType } = adj.meleeDamageFlat;
		lines.push(`Melee damage +${amount} ${damageType}`);
	}
	if (adj.rangedDamageFlat) {
		const { amount, damageType } = adj.rangedDamageFlat;
		lines.push(`Ranged damage +${amount} ${damageType}`);
	}
	if (adj.areaDamageFlat) {
		const { amount, damageType } = adj.areaDamageFlat;
		lines.push(`Area damage +${amount} ${damageType}`);
	}
	if (adj.attackRollDiceBonus) lines.push(`Attack rolls +${adj.attackRollDiceBonus}`);
	if (adj.attackRollDicePenalty) lines.push(`Attack rolls −${adj.attackRollDicePenalty}`);
	if (adj.savingThrowDiceBonus) lines.push(`Saving throws +${adj.savingThrowDiceBonus}`);
	if (adj.savingThrowDicePenalty) lines.push(`Saving throws −${adj.savingThrowDicePenalty}`);
	if (adj.saveDcBonusFlat !== undefined) lines.push(`Spell save DC +${adj.saveDcBonusFlat}`);
	if (adj.hasAdvantage) lines.push("Advantage on attacks");
	if (adj.hasDisadvantage) lines.push("Disadvantage on attacks");
	if (adj.critThresholdReduction !== undefined)
		lines.push(`Crit on ${20 - adj.critThresholdReduction}+`);
	if (adj.healingDoneFlat !== undefined) lines.push(`Healing done +${adj.healingDoneFlat}`);
	return lines;
}

export function StatusEffectTooltip({ effect }: StatusEffectTooltipProps) {
	const meta = getStatusEffectMeta(effect);
	const turns = effect.remainingTurns;
	const turnLabel = turns === 1 ? "1 turn" : `${turns} turns`;

	const valueLines: string[] = [];
	if (effect.value !== undefined) {
		if (meta.category === "buff") {
			valueLines.push(`${effect.value} HP healed per turn`);
		} else {
			valueLines.push(`${effect.value} damage per turn`);
		}
	}

	const adjLines = effect.adjustments ? formatAdjustmentLines(effect.adjustments) : [];
	const effectLines = [...valueLines, ...adjLines];

	const lineColor =
		meta.category === "buff"
			? "text-success"
			: meta.category === "debuff"
				? "text-error"
				: "text-text";

	return (
		<div className="px-2 py-2 space-y-1.5">
			{/* Header: name + remaining turns */}
			<div className="flex items-center justify-between gap-2">
				<span className="text-primary uppercase tracking-wide font-mono leading-none">
					{meta.name}
				</span>
				<span className="text-text font-mono leading-none shrink-0">{turnLabel}</span>
			</div>

			{/* Description */}
			<p className="text-text-muted leading-snug">{meta.description}</p>

			{/* Effect lines (only if any) */}
			{effectLines.length > 0 && (
				<>
					<div className="border-t border-border" />
					<ul className="space-y-0.5">
						{effectLines.map((line, i) => (
							<li key={i} className="flex gap-1">
								<span className="text-text-label shrink-0">•</span>
								<span className={lineColor}>{line}</span>
							</li>
						))}
					</ul>
				</>
			)}
		</div>
	);
}
