import { useHealth } from "../features/health/useHealth";

type SidebarProps = {
	open: boolean;
	onClose: () => void;
};

export default function Sidebar({ open, onClose }: SidebarProps) {
	const { data, isFetching, isError, refetch } = useHealth();

	return (
		<>
			<div
				onClick={onClose}
				className={`fixed inset-0 z-40 bg-black/40 md:hidden ${open ? "block" : "hidden"}`}
			/>

			<aside
				className={[
					"fixed md:static inset-y-0 left-0 z-50 md:z-0",
					"w-96 max-w-full bg-neutral-900 border-r border-neutral-800",
					"overflow-y-auto",
					"transform transition-transform duration-200",
					open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
				].join(" ")}
			>
				<div className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-900/95 backdrop-blur">
					<div className="flex items-center justify-between p-3">
						<div className="flex items-center gap-3">
							<button
								onClick={() => refetch()}
								disabled={isFetching}
								className="bg-primary px-3 py-2 text-sm font-medium text-white hover:opacity-80 disabled:opacity-50 transition"
							>
								Health Check
							</button>
							<span className="text-xs text-neutral-300" aria-live="polite">
								{isFetching
									? "Checking…"
									: isError
										? "Error"
										: data?.ok
											? "OK"
											: "—"}
							</span>
						</div>
						<button
							onClick={onClose}
							className="md:hidden px-2 py-1 text-neutral-300 hover:bg-neutral-800"
							aria-label="Close sidebar"
						>
							✕
						</button>
					</div>
				</div>

				<div className="p-4 space-y-3">
					<p className="text-sm text-neutral-400">
						You can put the game UI here, like score, health, settings, etc.
					</p>
				</div>
			</aside>
		</>
	);
}
