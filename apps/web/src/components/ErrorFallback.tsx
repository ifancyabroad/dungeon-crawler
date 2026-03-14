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
		<div className="flex min-h-screen flex-col items-center justify-center bg-bg-base p-8">
			<div className="max-w-md w-full space-y-4">
				<p className="text-base text-error">Something went wrong</p>
				<p className="text-sm text-text-muted">
					An unexpected error occurred. Please try refreshing the page.
				</p>
				<pre className="overflow-auto border border-border bg-bg-panel p-3 text-xs text-text-muted">
					{errorMessage}
				</pre>
				<Button onClick={resetErrorBoundary} variant="primary" size="md">
					Try Again
				</Button>
			</div>
		</div>
	);
}
