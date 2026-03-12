import type { ComponentPropsWithoutRef } from "react";
import { Label } from "./Label";

type InputProps = ComponentPropsWithoutRef<"input"> & {
	label?: string;
	error?: string;
};

export function Input({ label, error, className = "", id, ...rest }: InputProps) {
	const inputId = id ?? (label ? `input-${label.replace(/\s/g, "-").toLowerCase()}` : undefined);

	return (
		<div className="w-full">
			{label && <Label htmlFor={inputId}>{label}</Label>}
			<input
				id={inputId}
				className={[
					"w-full border-2 bg-bg-surface px-3 py-1.5 text-base text-text-bright",
					"placeholder:text-text-dim",
					"focus:outline-none focus:border-border-bright",
					"disabled:opacity-40 disabled:cursor-not-allowed",
					error ? "border-error" : "border-border",
					className,
				].join(" ")}
				aria-invalid={error ? true : undefined}
				aria-describedby={error ? `${inputId}-error` : undefined}
				{...rest}
			/>
			{error && (
				<p
					id={inputId ? `${inputId}-error` : undefined}
					className="mt-1 text-sm text-error"
					role="alert"
				>
					{error}
				</p>
			)}
		</div>
	);
}
