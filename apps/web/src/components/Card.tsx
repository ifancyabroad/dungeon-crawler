import type { ReactNode } from "react";

type CardVariant = "default" | "inset";

type CardProps = {
	children: ReactNode;
	title?: ReactNode;
	className?: string;
	variant?: CardVariant;
};

export function Card({ children, title, className = "", variant = "default" }: CardProps) {
	const containerClasses =
		variant === "inset"
			? `bg-black ${className}`
			: `border-2 border-border bg-black ${className}`;

	return (
		<div className={containerClasses.trim()}>
			{title != null && (
				<div className="border-b-2 border-border px-4 py-2">
					<span className="text-primary">{title}</span>
				</div>
			)}
			<div className="p-4">{children}</div>
		</div>
	);
}
