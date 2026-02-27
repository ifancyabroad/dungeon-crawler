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
			{label && (
				<Label htmlFor={inputId} className="mb-1.5">
					{label}
				</Label>
			)}
			<input
				id={inputId}
				className={[
					"w-full rounded border bg-bg-surface px-3 py-2 text-text",
					"placeholder:text-text-muted",
					"focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-bg-base",
					"disabled:opacity-50 disabled:cursor-not-allowed",
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
					className="mt-1.5 text-sm text-error"
					role="alert"
				>
					{error}
				</p>
			)}
		</div>
	);
}
