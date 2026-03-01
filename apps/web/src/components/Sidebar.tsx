import { Button } from "./Button";
import DebugMapForm from "./DebugMapForm";
import { useMapStore } from "../features/map/mapStore";

type SidebarProps = {
	open: boolean;
	onClose: () => void;
};

export default function Sidebar({ open, onClose }: SidebarProps) {
	const debugMode = useMapStore((s) => s.debugMode);
	const setDebugMode = useMapStore((s) => s.setDebugMode);
	const requestMapRegenerate = useMapStore((s) => s.requestMapRegenerate);
	const currentMapConfig = useMapStore((s) => s.mapConfigOverride);

	return (
		<>
			<div
				onClick={onClose}
				className={`fixed inset-0 z-40 bg-black/50 md:hidden ${open ? "block" : "hidden"}`}
			/>

			<aside
				className={[
					"fixed md:static inset-y-0 left-0 z-50 md:z-0",
					"w-80 max-w-full bg-bg-surface border-r border-border",
					"overflow-y-auto",
					"transform transition-transform duration-200",
					open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
				].join(" ")}
			>
				<div className="sticky top-0 z-10 border-b border-border bg-bg-surface/95 backdrop-blur">
					<div className="flex items-center justify-between px-5 py-4">
						<div>
							<h1 className="text-base font-semibold text-text">Menu</h1>
							<p className="text-xs text-text-muted mt-0.5">
								{debugMode ? "Debug controls" : "Game"}
							</p>
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
					<div className="flex items-center justify-between">
						<span className="text-sm text-text-muted">Debug mode</span>
						<button
							type="button"
							role="switch"
							aria-checked={debugMode}
							onClick={() => setDebugMode(!debugMode)}
							className={[
								"relative inline-flex h-6 w-11 shrink-0 rounded-full border border-border transition-colors",
								"focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-bg-surface",
								debugMode ? "bg-primary border-primary" : "bg-bg-elevated",
							].join(" ")}
						>
							<span
								className={[
									"pointer-events-none inline-block h-5 w-5 rounded-full bg-bg-surface shadow ring-0 transition-transform",
									debugMode ? "translate-x-5" : "translate-x-0.5",
								].join(" ")}
								style={{ marginTop: 2 }}
							/>
						</button>
					</div>

					{debugMode && (
						<DebugMapForm
							currentConfig={currentMapConfig}
							onGenerate={requestMapRegenerate}
							onClose={onClose}
						/>
					)}
				</div>
			</aside>
		</>
	);
}
