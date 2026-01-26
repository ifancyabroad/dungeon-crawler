import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { BrowserRouter } from "react-router-dom";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "./components/ErrorFallback";

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<ErrorBoundary
			FallbackComponent={ErrorFallback}
			onError={(error, info) => {
				console.error("ErrorBoundary caught an error:", error, info);
			}}
		>
			<QueryClientProvider client={queryClient}>
				<BrowserRouter>
					<App />
				</BrowserRouter>
				<ReactQueryDevtools initialIsOpen={false} />
			</QueryClientProvider>
		</ErrorBoundary>
	</StrictMode>,
);
