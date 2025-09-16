import { Link } from "react-router-dom";

export default function NotFound() {
	return (
		<div className="h-screen w-screen bg-slate-950 text-slate-100 flex items-center justify-center">
			<div className="text-center space-y-4">
				<p className="text-6xl font-bold text-slate-400">404</p>
				<h1 className="text-2xl font-semibold">Page not found</h1>
				<p className="text-slate-400">The page you’re looking for doesn’t exist.</p>
				<Link
					to="/"
					className="inline-block rounded-lg bg-sky-500 px-4 py-2 font-medium text-white hover:bg-sky-600 transition"
				>
					Go to Home
				</Link>
			</div>
		</div>
	);
}
