import { useQuery } from "@tanstack/react-query";
import type { HealthResponse } from "@app/shared";
import { api } from "../../lib/api";

export function useHealth() {
	return useQuery({
		queryKey: ["health"],
		queryFn: ({ signal }) => api.get("health", { signal }).json<HealthResponse>(),
		enabled: false,
	});
}
