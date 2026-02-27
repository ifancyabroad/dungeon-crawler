import type { ReactNode } from "react";

type CardProps = {
	children: ReactNode;
	title?: ReactNode;
	className?: string;
};

export function Card({ children, title, className = "" }: CardProps) {
	return (
		<div className={`rounded border border-border bg-bg-surface ${className}`.trim()}>
			{title != null && (
				<div className="border-b border-border px-4 py-3 font-medium text-text">
					{title}
				</div>
			)}
			<div className="p-4">{children}</div>
		</div>
	);
}
