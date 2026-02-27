import { Link } from "react-router-dom";
import { Button } from "../components/Button";

export default function NotFound() {
	return (
		<div className="h-screen w-screen bg-bg-base text-text flex items-center justify-center">
			<div className="text-center space-y-4">
				<p className="text-6xl font-bold text-text-muted">404</p>
				<h1 className="text-2xl font-semibold">Page not found</h1>
				<p className="text-text-muted">The page you’re looking for doesn’t exist.</p>
				<Button variant="primary" asChild>
					<Link to="/">Go to Home</Link>
				</Button>
			</div>
		</div>
	);
}
