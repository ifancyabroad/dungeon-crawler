import type { ItemInstance } from "@app/shared";
import type { ItemDefinition, AffixDefinition } from "@app/content";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { Tooltip } from "./Tooltip";
import { ItemTooltip } from "./ItemTooltip";
import { RARITY_TEXT } from "../lib/rarityColors";

type ConfirmReplaceModalProps = {
	incomingInstance: ItemInstance;
	incomingDef: ItemDefinition;
	incomingAffixDefs: AffixDefinition[];
	equippedInstance?: ItemInstance;
	equippedDef?: ItemDefinition;
	equippedAffixDefs?: AffixDefinition[];
	sideEffectInstance?: ItemInstance;
	sideEffectDef?: ItemDefinition;
	onConfirm: () => void;
	onCancel: () => void;
};

function ItemSpan({
	instance,
	def,
	affixDefs,
}: {
	instance: ItemInstance;
	def: ItemDefinition;
	affixDefs: AffixDefinition[];
}) {
	return (
		<Tooltip
			content={<ItemTooltip instance={instance} def={def} affixDefs={affixDefs} />}
			side="top"
			inline
		>
			<span
				className={`${RARITY_TEXT[instance.rarity]} cursor-default underline decoration-dotted`}
			>
				{instance.generatedName}
			</span>
		</Tooltip>
	);
}

export function ConfirmReplaceModal({
	incomingInstance,
	incomingDef,
	incomingAffixDefs,
	equippedInstance,
	equippedDef,
	equippedAffixDefs,
	sideEffectInstance,
	sideEffectDef,
	onConfirm,
	onCancel,
}: ConfirmReplaceModalProps) {
	return (
		<Modal
			open
			onClose={onCancel}
			title="Replace Equipment?"
			footer={
				<>
					<Button variant="secondary" onClick={onCancel}>
						Cancel
					</Button>
					<Button variant="primary" onClick={onConfirm}>
						Replace
					</Button>
				</>
			}
		>
			<p className="font-mono leading-relaxed text-text">
				Replace{" "}
				{equippedInstance && equippedDef && (
					<>
						<ItemSpan
							instance={equippedInstance}
							def={equippedDef}
							affixDefs={equippedAffixDefs ?? []}
						/>
						{sideEffectInstance && sideEffectDef && (
							<>
								{" "}
								and{" "}
								<ItemSpan
									instance={sideEffectInstance}
									def={sideEffectDef}
									affixDefs={[]}
								/>
							</>
						)}
					</>
				)}
				{!equippedInstance && sideEffectInstance && sideEffectDef && (
					<ItemSpan instance={sideEffectInstance} def={sideEffectDef} affixDefs={[]} />
				)}{" "}
				with{" "}
				<ItemSpan
					instance={incomingInstance}
					def={incomingDef}
					affixDefs={incomingAffixDefs}
				/>
				?
			</p>
		</Modal>
	);
}
