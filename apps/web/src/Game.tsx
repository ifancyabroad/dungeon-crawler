import GameCanvas from "./components/GameCanvas";
import { useHealth } from "./features/health/useHealth";

export default function Game() {
	const { data, isFetching, isError, refetch } = useHealth();

	return (
		<main className="min-h-screen grid place-items-center bg-slate-950 text-slate-100 p-6">
			<div className="flex flex-col items-start gap-6">
				<GameCanvas width={800} height={600}>
					<div className="flex items-center gap-3">
						<button
							onClick={() => refetch()}
							disabled={isFetching}
							className="rounded-lg bg-slate-800 px-4 py-2 font-medium text-white hover:bg-slate-600 active:translate-y-px disabled:opacity-50 transition"
						>
							Test API Health
						</button>
						<span className="text-sm text-slate-200" aria-live="polite">
							{isFetching ? "Checking…" : isError ? "Error" : data?.ok ? "OK" : "—"}
						</span>
					</div>
				</GameCanvas>
			</div>
		</main>
	);
}
