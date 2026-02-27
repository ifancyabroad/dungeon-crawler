import type { FallbackProps } from "react-error-boundary";
import { Button } from "./Button";

/**
 * Extract error message from unknown error type.
 */
function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	return String(error);
}

/**
 * Default fallback UI displayed when an error is caught by an ErrorBoundary.
 * Customize this component to match your app's design.
 */
export function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
	const errorMessage = getErrorMessage(error);

	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-bg-base p-8 text-text">
			<div className="max-w-md text-center">
				<h1 className="mb-4 text-2xl font-bold text-error">Something went wrong</h1>
				<p className="mb-6 text-text-muted">
					An unexpected error occurred. Please try refreshing the page.
				</p>
				<pre className="mb-6 overflow-auto rounded bg-bg-surface p-4 text-left text-sm text-text">
					{errorMessage}
				</pre>
				<Button onClick={resetErrorBoundary} variant="primary">
					Try Again
				</Button>
			</div>
		</div>
	);
}
