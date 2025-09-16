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
					"w-72 bg-slate-900 border-r border-slate-800",
					"overflow-y-auto",
					"transform transition-transform duration-200",
					open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
				].join(" ")}
			>
				<div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
					<div className="flex items-center justify-between p-3">
						<h2 className="text-slate-100 font-semibold">Controls</h2>
						<button
							onClick={onClose}
							className="md:hidden rounded-md px-2 py-1 text-slate-300 hover:bg-slate-800"
							aria-label="Close sidebar"
						>
							✕
						</button>
					</div>
					<div className="px-3 pb-3 flex items-center gap-3">
						<button
							onClick={() => refetch()}
							disabled={isFetching}
							className="rounded-lg bg-sky-500 px-3 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50 transition"
						>
							Test API
						</button>
						<span className="text-xs text-slate-300" aria-live="polite">
							{isFetching ? "Checking…" : isError ? "Error" : data?.ok ? "OK" : "—"}
						</span>
					</div>
				</div>

				<div className="p-4 space-y-3">
					<p className="text-sm text-slate-400">
						Add more controls here (settings, debug toggles, etc.).
					</p>
				</div>
			</aside>
		</>
	);
}
