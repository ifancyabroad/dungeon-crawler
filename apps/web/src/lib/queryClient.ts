import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: 1,
			staleTime: 30_000, // cached for 30s
			gcTime: 5 * 60_000, // garbage-collect after 5m
			refetchOnWindowFocus: false,
		},
	},
});
