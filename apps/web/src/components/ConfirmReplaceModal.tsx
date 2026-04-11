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
	equippedInstance: ItemInstance;
	equippedDef: ItemDefinition;
	equippedAffixDefs: AffixDefinition[];
	onConfirm: () => void;
	onCancel: () => void;
};

export function ConfirmReplaceModal({
	incomingInstance,
	incomingDef,
	incomingAffixDefs,
	equippedInstance,
	equippedDef,
	equippedAffixDefs,
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
			<p className="font-mono leading-relaxed">
				Replace{" "}
				<Tooltip
					content={
						<ItemTooltip
							instance={equippedInstance}
							def={equippedDef}
							affixDefs={equippedAffixDefs}
						/>
					}
					side="top"
					inline
				>
					<span
						className={`${RARITY_TEXT[equippedInstance.rarity]} cursor-default underline decoration-dotted`}
					>
						{equippedInstance.generatedName}
					</span>
				</Tooltip>{" "}
				with{" "}
				<Tooltip
					content={
						<ItemTooltip
							instance={incomingInstance}
							def={incomingDef}
							affixDefs={incomingAffixDefs}
						/>
					}
					side="top"
					inline
				>
					<span
						className={`${RARITY_TEXT[incomingInstance.rarity]} cursor-default underline decoration-dotted`}
					>
						{incomingInstance.generatedName}
					</span>
				</Tooltip>
				?
			</p>
		</Modal>
	);
}
