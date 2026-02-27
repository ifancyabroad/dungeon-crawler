import {
	cloneElement,
	isValidElement,
	type ComponentPropsWithoutRef,
	type ReactElement,
	type ReactNode,
} from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ComponentPropsWithoutRef<"button"> & {
	variant?: ButtonVariant;
	size?: ButtonSize;
	asChild?: boolean;
	children?: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
	primary: "bg-primary text-primary-contrast hover:bg-primary/90 focus-visible:ring-primary/50",
	secondary:
		"bg-secondary text-secondary-contrast hover:bg-secondary/90 focus-visible:ring-secondary/50",
	ghost: "bg-transparent text-text hover:bg-bg-elevated focus-visible:ring-border",
	danger: "bg-error text-white hover:bg-error/90 focus-visible:ring-error/50",
};

const sizeClasses: Record<ButtonSize, string> = {
	sm: "px-2.5 py-1.5 text-sm",
	md: "px-4 py-2 text-sm",
	lg: "px-6 py-3 text-base",
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
		"inline-flex items-center justify-center font-medium rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base disabled:opacity-50 disabled:pointer-events-none";
	const variantClass = variantClasses[variant];
	const sizeClass = sizeClasses[size];
	const combinedClassName = `${base} ${variantClass} ${sizeClass} ${className}`.trim();

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
