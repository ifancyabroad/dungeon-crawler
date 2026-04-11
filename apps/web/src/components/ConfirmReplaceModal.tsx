import type { ItemInstance } from "@app/shared";
import type { ItemDefinition, AffixDefinition } from "@app/content";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { ItemTooltip } from "./ItemTooltip";

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

function ItemPanel({
	label,
	instance,
	def,
	affixDefs,
}: {
	label: string;
	instance: ItemInstance;
	def: ItemDefinition;
	affixDefs: AffixDefinition[];
}) {
	return (
		<div className="space-y-1">
			<p className="font-mono text-text-label uppercase tracking-wide">{label}</p>
			<div className="border border-border">
				<ItemTooltip instance={instance} def={def} affixDefs={affixDefs} />
			</div>
		</div>
	);
}

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
			<div className="space-y-4">
				<ItemPanel
					label="Currently Equipped"
					instance={equippedInstance}
					def={equippedDef}
					affixDefs={equippedAffixDefs}
				/>
				<ItemPanel
					label="Replacing With"
					instance={incomingInstance}
					def={incomingDef}
					affixDefs={incomingAffixDefs}
				/>
			</div>
		</Modal>
	);
}
