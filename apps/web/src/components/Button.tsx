import {
	cloneElement,
	isValidElement,
	type ComponentPropsWithoutRef,
	type ReactElement,
	type ReactNode,
} from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg" | "icon";

type ButtonProps = ComponentPropsWithoutRef<"button"> & {
	variant?: ButtonVariant;
	size?: ButtonSize;
	asChild?: boolean;
	children?: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
	primary:
		"bg-primary text-primary-contrast border-primary hover:bg-primary-dim focus-visible:ring-primary/50",
	secondary:
		"bg-black text-text-muted border-border hover:text-text hover:border-border-bright focus-visible:ring-border",
	ghost: "bg-transparent text-text-muted border-transparent hover:text-text hover:border-border focus-visible:ring-border",
	danger: "bg-error text-text-bright border-error hover:bg-error/80 focus-visible:ring-error/50",
};

const sizeClasses: Record<ButtonSize, string> = {
	sm: "px-3 py-1",
	md: "px-4 py-1.5",
	lg: "px-5 py-2",
	icon: "p-2",
};

export function Button({
	children,
	variant = "primary",
	size = "md",
	className = "",
	disabled,
	type = "button",
	asChild = false,
	...rest
}: ButtonProps) {
	const base =
		"inline-flex items-center justify-center font-mono text-xs uppercase tracking-wider border transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-base disabled:opacity-40 disabled:pointer-events-none";
	const combinedClassName =
		`${base} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`.trim();

	if (asChild && isValidElement(children)) {
		const child = children as ReactElement<{ className?: string }>;
		return cloneElement(child, {
			className: child.props.className
				? `${combinedClassName} ${child.props.className}`
				: combinedClassName,
			...rest,
		});
	}

	return (
		<button type={type} disabled={disabled} className={combinedClassName} {...rest}>
			{children}
		</button>
	);
}
