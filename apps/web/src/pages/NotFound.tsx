import { Link } from "react-router-dom";
import { Button } from "../components/Button";

export default function NotFound() {
	return (
		<div className="h-screen w-screen bg-bg-base flex items-center justify-center">
			<div className="text-center space-y-4">
				<p className="text-5xl text-text-muted">404</p>
				<p className="text-lg text-primary">Page not found</p>
				<p className="text-base text-text-muted">This path leads nowhere.</p>
				<Button variant="secondary" size="md" asChild>
					<Link to="/">Return to Menu</Link>
				</Button>
			</div>
		</div>
	);
}
