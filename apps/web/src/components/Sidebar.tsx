import { Button } from "./Button";

type SidebarProps = {
	open: boolean;
	onClose: () => void;
};

export default function Sidebar({ open, onClose }: SidebarProps) {
	return (
		<>
			<div
				onClick={onClose}
				className={`fixed inset-0 z-40 bg-black/50 md:hidden ${open ? "block" : "hidden"}`}
			/>

			<aside
				className={[
					"fixed md:static inset-y-0 left-0 z-50 md:z-0",
					"w-80 max-w-full bg-bg-base border-r border-border",
					"overflow-y-auto",
					"transform transition-transform duration-200",
					open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
				].join(" ")}
			>
				<div className="sticky top-0 z-10 border-b border-border bg-bg-base/95 backdrop-blur">
					<div className="flex items-center justify-between px-5 py-4">
						<div>
							<h1 className="text-base font-semibold text-text">Menu</h1>
							<p className="text-xs text-text-muted mt-0.5">Game</p>
						</div>
						<Button
							variant="ghost"
							size="sm"
							onClick={onClose}
							aria-label="Close sidebar"
							className="md:hidden p-1.5"
						>
							<svg
								className="w-4 h-4"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M6 18L18 6M6 6l12 12"
								/>
							</svg>
						</Button>
					</div>
				</div>

				<div className="px-5 py-4 space-y-4">
					<p className="text-sm text-text-muted">
						Hero information — stats and inventory will appear here.
					</p>
				</div>
			</aside>
		</>
	);
}
