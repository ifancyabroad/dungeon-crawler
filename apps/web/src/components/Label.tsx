import type { ComponentPropsWithoutRef } from "react";

type LabelProps = ComponentPropsWithoutRef<"label"> & {
	required?: boolean;
};

export function Label({ children, className = "", required, ...rest }: LabelProps) {
	return (
		<label className={`block text-text-label mb-1 ${className}`.trim()} {...rest}>
			{children}
			{required && (
				<span className="text-error ml-0.5" aria-hidden>
					*
				</span>
			)}
		</label>
	);
}
