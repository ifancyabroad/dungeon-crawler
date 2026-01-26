import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ScoreInput, ScoreResponse } from "@app/shared";
import { api } from "../../lib/api";

export function useScores() {
	return useQuery({
		queryKey: ["scores"],
		queryFn: ({ signal }) => api.get("scores", { signal }).json<ScoreResponse[]>(),
	});
}

export function useCreateScore() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: ScoreInput) => api.post("scores", { json: body }).json<ScoreResponse>(),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["scores"] });
		},
	});
}
