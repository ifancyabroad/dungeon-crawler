import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";

type Health = { ok: boolean };

export function useHealth() {
	return useQuery({
		queryKey: ["health"],
		queryFn: ({ signal }) => api.get<Health>("health", { signal }),
		enabled: false,
	});
}
