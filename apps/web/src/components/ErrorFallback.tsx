import type { FallbackProps } from "react-error-boundary";

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
		<div className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 p-8 text-white">
			<div className="max-w-md text-center">
				<h1 className="mb-4 text-2xl font-bold text-red-500">Something went wrong</h1>
				<p className="mb-6 text-neutral-400">
					An unexpected error occurred. Please try refreshing the page.
				</p>
				<pre className="mb-6 overflow-auto rounded bg-neutral-900 p-4 text-left text-sm text-neutral-300">
					{errorMessage}
				</pre>
				<button
					onClick={resetErrorBoundary}
					className="rounded bg-primary px-6 py-2 font-medium text-white transition-colors hover:bg-primary/80"
				>
					Try Again
				</button>
			</div>
		</div>
	);
}
