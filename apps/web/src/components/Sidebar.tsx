import { useScores } from "../features/scores/useScores";
import { Button } from "./Button";

type SidebarProps = {
	open: boolean;
	onClose: () => void;
};

export default function Sidebar({ open, onClose }: SidebarProps) {
	const { data: scores, isLoading: scoresLoading, isError: scoresError } = useScores();

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
				{/* Header */}
				<div className="sticky top-0 z-10 border-b border-border bg-bg-surface/95 backdrop-blur">
					<div className="flex items-center justify-between px-5 py-4">
						<div>
							<h1 className="text-base font-semibold text-text">
								MERN Phaser Template
							</h1>
							<p className="text-xs text-text-muted mt-0.5">
								Full-stack game starter
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

				{/* Leaderboard */}
				<div className="px-5 py-4">
					<h2 className="text-xs font-medium uppercase tracking-wider text-text-muted mb-3">
						Leaderboard
					</h2>

					{scoresLoading && <p className="text-sm text-text-muted">Loading...</p>}

					{scoresError && (
						<p className="text-sm text-text-muted">Unable to load scores</p>
					)}

					{scores && scores.length === 0 && (
						<p className="text-sm text-text-muted">No entries yet</p>
					)}

					{scores && scores.length > 0 && (
						<div className="space-y-1">
							{scores.slice(0, 10).map((score, index) => (
								<div
									key={score._id}
									className="flex items-center justify-between py-2 px-3 rounded hover:bg-bg-elevated/50 transition-colors"
								>
									<div className="flex items-center gap-3">
										<span className="text-xs font-medium text-text-muted w-4">
											{index + 1}
										</span>
										<span className="text-sm text-text">{score.player}</span>
									</div>
									<span className="text-sm font-medium tabular-nums text-text-muted">
										{score.points.toLocaleString()}
									</span>
								</div>
							))}
						</div>
					)}
				</div>
			</aside>
		</>
	);
}
