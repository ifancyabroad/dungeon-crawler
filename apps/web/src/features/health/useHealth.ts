import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";

type Health = { ok: boolean };

export function useHealth() {
	return useQuery({
		queryKey: ["health"],
		queryFn: ({ signal }) => apiFetch<Health>("/health", { signal }),
		enabled: false,
	});
}
